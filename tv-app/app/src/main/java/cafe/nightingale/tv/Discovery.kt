package cafe.nightingale.tv

import android.os.SystemClock
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException
import java.net.URL

/** A Nightingale server found on the network (or typed by hand). */
data class Server(val name: String, val host: String, val port: Int, val version: String = "") {
    val url: String get() = "http://$host:$port/"
    val label: String get() = if (name.isBlank()) "$host:$port" else "$name  ·  $host"
}

/**
 * LAN discovery: broadcast a probe on UDP [PORT]; every Nightingale server
 * answers with `{"service":"nightingale","name":…,"port":…,"version":…}`.
 * The answer's source address is the server's IP.
 */
object Discovery {
    const val PORT = 64451
    const val DEFAULT_HTTP_PORT = 8080

    private val PROBE = "NIGHTINGALE?".toByteArray()
    private const val RECEIVE_SLICE_MS = 250

    /** Blocking: call it off the main thread. */
    fun scan(durationMs: Long = 1_500): List<Server> {
        val found = LinkedHashMap<String, Server>()
        DatagramSocket().use { socket ->
            socket.broadcast = true
            socket.soTimeout = RECEIVE_SLICE_MS
            for (address in broadcastAddresses()) {
                runCatching { socket.send(DatagramPacket(PROBE, PROBE.size, address, PORT)) }
            }
            val buffer = ByteArray(2048)
            val deadline = SystemClock.elapsedRealtime() + durationMs
            while (SystemClock.elapsedRealtime() < deadline) {
                val packet = DatagramPacket(buffer, buffer.size)
                try {
                    socket.receive(packet)
                } catch (_: SocketTimeoutException) {
                    continue
                }
                parse(packet)?.let { found["${it.host}:${it.port}"] = it }
            }
        }
        return found.values.toList()
    }

    /** Blocking: does a Nightingale server answer at this address? */
    fun isReachable(server: Server, timeoutMs: Int = 1_500): Boolean = runCatching {
        val connection = URL("${server.url}api/bootstrap").openConnection() as HttpURLConnection
        connection.connectTimeout = timeoutMs
        connection.readTimeout = timeoutMs
        try {
            connection.responseCode == HttpURLConnection.HTTP_OK
        } finally {
            connection.disconnect()
        }
    }.getOrDefault(false)

    /** "192.168.1.10" or "192.168.1.10:8080" (an optional http:// is ignored). */
    fun parseAddress(input: String): Server? {
        val trimmed = input.trim().removePrefix("http://").removeSuffix("/")
        if (trimmed.isEmpty()) {
            return null
        }
        val host = trimmed.substringBefore(':')
        val port = trimmed.substringAfter(':', "").toIntOrNull() ?: DEFAULT_HTTP_PORT
        if (host.isEmpty() || port !in 1..65535) {
            return null
        }
        return Server(name = "", host = host, port = port)
    }

    private fun parse(packet: DatagramPacket): Server? = runCatching {
        val json = JSONObject(String(packet.data, 0, packet.length, Charsets.UTF_8))
        if (json.optString("service") != "nightingale") {
            return null
        }
        Server(
            name = json.optString("name"),
            host = packet.address.hostAddress ?: return null,
            port = json.optInt("port", DEFAULT_HTTP_PORT),
            version = json.optString("version"),
        )
    }.getOrNull()

    /** The global broadcast plus each interface's own (some routers drop the global one). */
    private fun broadcastAddresses(): List<InetAddress> {
        val addresses = mutableListOf(InetAddress.getByName("255.255.255.255"))
        runCatching {
            NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
                .filter { it.isUp && !it.isLoopback }
                .forEach { network ->
                    network.interfaceAddresses.mapNotNullTo(addresses) { it.broadcast }
                }
        }
        return addresses.distinct()
    }
}
