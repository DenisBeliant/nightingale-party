//! HTTPS listener for the multiplayer party: phone browsers only allow the
//! microphone on secure pages, so the phone surface is also served over TLS
//! with a self-signed certificate (`app_core::party_certificate`).

use crate::{remote_router, AppState};

/// Serve the phone surface over HTTPS on [`app_core::PARTY_TLS_PORT`].
/// Failure only disables the party's microphones; plain HTTP keeps working.
pub async fn serve_party_tls(state: AppState) {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let certificate = match tokio::task::spawn_blocking(app_core::party_certificate).await {
        Ok(Ok(certificate)) => certificate,
        Ok(Err(error)) => {
            tracing::error!("party certificate unavailable: {error}");
            return;
        }
        Err(error) => {
            tracing::error!("party certificate task failed: {error}");
            return;
        }
    };
    let config = match axum_server::tls_rustls::RustlsConfig::from_pem(
        certificate.cert_pem.into_bytes(),
        certificate.key_pem.into_bytes(),
    )
    .await
    {
        Ok(config) => config,
        Err(error) => {
            tracing::error!("party TLS configuration failed: {error}");
            return;
        }
    };
    let address = std::net::SocketAddr::from(([0, 0, 0, 0], app_core::PARTY_TLS_PORT));
    tracing::info!(%address, "party HTTPS listening");
    if let Err(error) = axum_server::bind_rustls(address, config)
        .serve(remote_router(state).into_make_service())
        .await
    {
        tracing::error!("party HTTPS server error: {error}");
    }
}
