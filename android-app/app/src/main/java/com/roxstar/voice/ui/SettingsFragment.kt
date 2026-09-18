package com.roxstar.voice.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.roxstar.voice.MainActivity
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.databinding.FragmentSettingsBinding

class SettingsFragment : Fragment() {
    private var binding: FragmentSettingsBinding? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentSettingsBinding.inflate(inflater, container, false)
        binding = view
        val app = RoxStarApp.instance
        view.account.text = "Signed in as ${app.session.userName ?: "guest"}"
        view.apiUrl.setText(app.session.apiBaseUrl)
        view.saveUrl.setOnClickListener {
            app.applyApiBaseUrl(view.apiUrl.text?.toString().orEmpty())
            view.apiUrl.setText(app.session.apiBaseUrl)
            Toast.makeText(requireContext(), "Server saved", Toast.LENGTH_SHORT).show()
        }
        view.logout.setOnClickListener { (activity as MainActivity).logout() }
        return view.root
    }

    override fun onResume() {
        super.onResume()
        (activity as? androidx.appcompat.app.AppCompatActivity)?.supportActionBar?.title = "Settings"
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
