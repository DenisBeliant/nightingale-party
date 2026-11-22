package cafe.nightingale.tv

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Server picker. On launch it reconnects to the last server when it answers;
 * otherwise it scans the network and lists every Nightingale server found,
 * as big buttons for the remote. An address can still be typed as a fallback.
 */
class MainActivity : Activity() {

    private lateinit var store: ServerStore
    private lateinit var status: TextView
    private lateinit var list: LinearLayout
    private lateinit var rescan: Button

    @Volatile
    private var scanning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ServerStore(this)
        setContentView(buildLayout())

        val last = store.last
        val autoConnect = !intent.getBooleanExtra(EXTRA_NO_AUTO_CONNECT, false)
        if (last != null && autoConnect) {
            tryLast(last)
        } else {
            scan()
        }
    }

    // ── Flow ───────────────────────────────────────────────────────────────

    private fun tryLast(server: Server) {
        status.text = getString(R.string.picker_connecting, server.label)
        background {
            val reachable = Discovery.isReachable(server)
            runOnUiThread {
                if (reachable) {
                    open(server)
                } else {
                    status.text = getString(R.string.picker_unreachable, server.label)
                    scan()
                }
            }
        }
    }

    private fun scan() {
        if (scanning) {
            return
        }
        scanning = true
        rescan.isEnabled = false
        status.text = getString(R.string.picker_searching)
        background {
            val servers = runCatching { Discovery.scan() }.getOrDefault(emptyList())
            runOnUiThread {
                scanning = false
                rescan.isEnabled = true
                show(servers)
            }
        }
    }

    private fun show(found: List<Server>) {
        list.removeAllViews()
        val last = store.last
        val servers = found.sortedByDescending { sameServer(it, last) }
        status.text = getString(if (servers.isEmpty()) R.string.picker_none else R.string.picker_found)
        servers.forEach { server ->
            val text = if (sameServer(server, last)) "${server.label}  ·  ${getString(R.string.picker_last)}" else server.label
            list.addView(bigButton(text) { open(server) })
        }
        (list.getChildAt(0) ?: rescan).requestFocus()
    }

    private fun open(server: Server) {
        store.last = server
        startActivity(
            Intent(this, WebActivity::class.java)
                .putExtra(WebActivity.EXTRA_URL, server.url)
                .putExtra(WebActivity.EXTRA_LABEL, server.label),
        )
        finish()
    }

    private fun askAddress() {
        val input = EditText(this).apply {
            hint = getString(R.string.manual_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
            store.last?.let { setText("${it.host}:${it.port}") }
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.manual_title)
            .setView(input)
            .setPositiveButton(R.string.manual_ok) { _, _ ->
                val server = Discovery.parseAddress(input.text.toString()) ?: return@setPositiveButton
                tryLast(server)
            }
            .setNegativeButton(R.string.manual_cancel, null)
            .show()
    }

    // ── Layout (built in code: a handful of views, no library) ─────────────

    private fun buildLayout(): View {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(64), dp(48), dp(64), dp(48))
        }
        column.addView(TextView(this).apply {
            text = getString(R.string.picker_title)
            setTextColor(getColor(R.color.text))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 34f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        })
        status = TextView(this).apply {
            setTextColor(getColor(R.color.muted))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(24))
        }
        column.addView(status)
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        column.addView(list, LinearLayout.LayoutParams(dp(720), ViewGroup.LayoutParams.WRAP_CONTENT))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, 0)
        }
        rescan = bigButton(getString(R.string.picker_rescan)) { scan() }
        actions.addView(rescan, wrap())
        actions.addView(bigButton(getString(R.string.picker_manual)) { askAddress() }, wrap())
        column.addView(actions)

        return ScrollView(this).apply {
            isFillViewport = true
            addView(column)
        }
    }

    private fun bigButton(label: String, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(getColor(R.color.text))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        typeface = Typeface.DEFAULT_BOLD
        background = getDrawable(R.drawable.server_button)
        setPadding(dp(28), dp(18), dp(28), dp(18))
        isFocusable = true
        isFocusableInTouchMode = true
        stateListAnimator = null
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { setMargins(dp(8), dp(8), dp(8), dp(8)) }
    }

    private fun wrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { setMargins(dp(8), dp(8), dp(8), dp(8)) }

    private fun sameServer(server: Server, other: Server?): Boolean =
        other != null && server.host == other.host && server.port == other.port

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun background(task: () -> Unit) {
        Thread(task, "nightingale-discovery").start()
    }

    companion object {
        /** Show the picker even when a last server is saved (after an error, or from the menu key). */
        const val EXTRA_NO_AUTO_CONNECT = "no_auto_connect"
    }
}
