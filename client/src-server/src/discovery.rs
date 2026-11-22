//! LAN discovery for the TV app: it broadcasts a probe on UDP
//! [`DISCOVERY_PORT`] and every Nightingale server on the network answers with
//! its name and HTTP port, so nobody has to type an IP address on a remote.

use std::net::SocketAddr;

use serde_json::json;
use tokio::net::UdpSocket;

/// UDP port the TV app probes. Next to the desktop's remote (64449) and party (64450) ports.
pub const DISCOVERY_PORT: u16 = 64451;

/// What a probe datagram starts with; anything else is ignored.
const PROBE: &[u8] = b"NIGHTINGALE?";

/// Answer discovery probes until the process exits. `http` is the address the
/// web server listens on; a loopback bind is not reachable, so nothing runs.
/// `name` is shown in the TV's server list (the host name by default).
pub async fn serve_discovery(http: SocketAddr, name: Option<String>) {
    if http.ip().is_loopback() {
        return;
    }
    let socket = match UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)).await {
        Ok(socket) => socket,
        Err(error) => {
            tracing::warn!("TV discovery unavailable on UDP {DISCOVERY_PORT}: {error}");
            return;
        }
    };
    tracing::info!(port = DISCOVERY_PORT, "TV discovery listening");
    let reply = json!({
        "service": "nightingale",
        "name": name.filter(|name| !name.trim().is_empty()).unwrap_or_else(host_name),
        "port": http.port(),
        "version": env!("CARGO_PKG_VERSION"),
    })
    .to_string();
    let mut buffer = [0_u8; 64];
    loop {
        let Ok((length, peer)) = socket.recv_from(&mut buffer).await else {
            continue;
        };
        if !buffer[..length].starts_with(PROBE) {
            continue;
        }
        if let Err(error) = socket.send_to(reply.as_bytes(), peer).await {
            tracing::debug!(%peer, "TV discovery reply failed: {error}");
        }
    }
}

/// The machine's name, shown in the TV's server list.
fn host_name() -> String {
    std::fs::read_to_string("/etc/hostname")
        .ok()
        .or_else(|| std::env::var("COMPUTERNAME").ok())
        .or_else(|| std::env::var("HOSTNAME").ok())
        .map(|name| name.trim().to_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Nightingale".to_owned())
}
