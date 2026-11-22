//! Self-signed certificate for the HTTPS party page.
//!
//! Phone browsers only expose the microphone on secure pages, and a LAN
//! address cannot get a publicly trusted certificate. Each phone therefore
//! accepts this certificate once ("continue anyway"). It is kept on disk so
//! the warning is not repeated on every launch, and regenerated when the LAN
//! address it was issued for changes.

use std::path::PathBuf;

use crate::cache::default_nightingale_dir;
use crate::remote_control::lan_ip;

pub struct PartyCertificate {
    pub cert_pem: String,
    pub key_pem: String,
}

fn tls_dir() -> PathBuf {
    default_nightingale_dir().join("party-tls")
}

fn current_hosts() -> Vec<String> {
    let mut hosts = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    if let Some(ip) = lan_ip() {
        hosts.push(ip.to_string());
    }
    hosts
}

/// Load the stored certificate, or issue a new one for the current addresses.
pub fn party_certificate() -> Result<PartyCertificate, String> {
    let dir = tls_dir();
    let hosts = current_hosts();
    let hosts_line = hosts.join(",");
    let cert_path = dir.join("cert.pem");
    let key_path = dir.join("key.pem");
    let hosts_path = dir.join("hosts.txt");

    let stored_hosts = std::fs::read_to_string(&hosts_path).unwrap_or_default();
    if stored_hosts.trim() == hosts_line
        && let (Ok(cert_pem), Ok(key_pem)) = (
            std::fs::read_to_string(&cert_path),
            std::fs::read_to_string(&key_path),
        )
    {
        return Ok(PartyCertificate { cert_pem, key_pem });
    }

    let issued = rcgen::generate_simple_self_signed(hosts)
        .map_err(|error| format!("could not create the party certificate: {error}"))?;
    let certificate = PartyCertificate {
        cert_pem: issued.cert.pem(),
        key_pem: issued.key_pair.serialize_pem(),
    };

    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    std::fs::write(&cert_path, &certificate.cert_pem).map_err(|error| error.to_string())?;
    std::fs::write(&key_path, &certificate.key_pem).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::write(&hosts_path, hosts_line).map_err(|error| error.to_string())?;
    Ok(certificate)
}
