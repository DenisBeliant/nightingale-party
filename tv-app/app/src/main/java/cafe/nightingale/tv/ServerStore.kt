package cafe.nightingale.tv

import android.content.Context

/** Remembers the last server so the next launch goes straight to it. */
class ServerStore(context: Context) {
    private val prefs = context.getSharedPreferences("servers", Context.MODE_PRIVATE)

    var last: Server?
        get() {
            val host = prefs.getString(KEY_HOST, null) ?: return null
            return Server(
                name = prefs.getString(KEY_NAME, "").orEmpty(),
                host = host,
                port = prefs.getInt(KEY_PORT, Discovery.DEFAULT_HTTP_PORT),
            )
        }
        set(value) {
            prefs.edit().apply {
                if (value == null) {
                    clear()
                } else {
                    putString(KEY_NAME, value.name)
                    putString(KEY_HOST, value.host)
                    putInt(KEY_PORT, value.port)
                }
            }.apply()
        }

    private companion object {
        const val KEY_NAME = "name"
        const val KEY_HOST = "host"
        const val KEY_PORT = "port"
    }
}
