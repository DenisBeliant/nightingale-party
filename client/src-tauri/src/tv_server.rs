//! "Play on the TV": the desktop app serves the whole web app on the LAN, so
//! the Nightingale TV app finds this computer (UDP discovery) and shows the
//! party screen, while this process keeps the library, analyses and party.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use app_api::CommandState;
use serde::Serialize;
use server::{AppState as RemoteAppState, EventBus};
use tauri::async_runtime::JoinHandle;

/// Preferred port: the one the self-hosted Docker setup publishes. Another
/// free port is used when it is taken; the TV learns it through discovery.
const TV_PORT: u16 = 64448;

/// What the "Play" screen shows about the TV server.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TvServerStatus {
    running: bool,
    /// Name the TV lists this computer under.
    name: String,
    /// `http://<lan-ip>:<port>`, to type on the TV if discovery is blocked.
    url: Option<String>,
    error: Option<String>,
}

struct Running {
    address: SocketAddr,
    tasks: Vec<JoinHandle<()>>,
}

pub(crate) struct TvServer {
    commands: CommandState,
    events: Arc<EventBus>,
    running: Mutex<Option<Running>>,
    error: Mutex<Option<String>>,
}

impl TvServer {
    pub(crate) fn new(commands: CommandState, events: Arc<EventBus>) -> Self {
        Self {
            commands,
            events,
            running: Mutex::new(None),
            error: Mutex::new(None),
        }
    }

    pub(crate) fn status(&self) -> TvServerStatus {
        let address = self
            .running
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .map(|running| running.address);
        TvServerStatus {
            running: address.is_some(),
            name: host_name(),
            url: address.and_then(|address| app_core::lan_base(address.port())),
            error: self
                .error
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone(),
        }
    }

    fn is_running(&self) -> bool {
        self.running
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_some()
    }

    fn set_error(&self, error: Option<String>) {
        *self.error.lock().unwrap_or_else(|error| error.into_inner()) = error;
    }

    pub(crate) async fn start(&self) -> TvServerStatus {
        if self.is_running() {
            return self.status();
        }
        let listener = match bind().await {
            Ok(listener) => listener,
            Err(error) => {
                tracing::error!("TV server: {error}");
                self.set_error(Some(error));
                return self.status();
            }
        };
        let address = match listener.local_addr() {
            Ok(address) => address,
            Err(error) => {
                self.set_error(Some(error.to_string()));
                return self.status();
            }
        };

        let state = RemoteAppState::new(
            self.commands.clone(),
            self.events.clone(),
            app_core::RemoteControl::load(),
            server::RemoteAddress::new(address, None),
            false,
            false,
        );
        let http = tauri::async_runtime::spawn(async move {
            if let Err(error) =
                axum::serve(listener, server::router(state).into_make_service()).await
            {
                tracing::error!("TV server error: {error}");
            }
        });
        let discovery =
            tauri::async_runtime::spawn(server::serve_discovery(address, Some(host_name())));
        tracing::info!(%address, "TV server listening");

        let mut running = self
            .running
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if running.is_some() {
            // Started twice at once: keep the first server.
            http.abort();
            discovery.abort();
        } else {
            *running = Some(Running {
                address,
                tasks: vec![http, discovery],
            });
        }
        drop(running);
        self.set_error(None);
        self.status()
    }

    pub(crate) fn stop(&self) -> TvServerStatus {
        let stopped = self
            .running
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(running) = stopped {
            for task in running.tasks {
                task.abort();
            }
            tracing::info!("TV server stopped");
        }
        self.set_error(None);
        self.status()
    }
}

async fn bind() -> Result<tokio::net::TcpListener, String> {
    let preferred = SocketAddr::from(([0, 0, 0, 0], TV_PORT));
    match tokio::net::TcpListener::bind(preferred).await {
        Ok(listener) => Ok(listener),
        Err(_) => tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], 0)))
            .await
            .map_err(|error| format!("cannot listen for the TV: {error}")),
    }
}

/// This computer's name, as the TV lists it.
fn host_name() -> String {
    std::fs::read_to_string("/etc/hostname")
        .ok()
        .or_else(|| std::env::var("COMPUTERNAME").ok())
        .or_else(|| std::env::var("HOSTNAME").ok())
        .map(|name| name.trim().to_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Nightingale".to_owned())
}
