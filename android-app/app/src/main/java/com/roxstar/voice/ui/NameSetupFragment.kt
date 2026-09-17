package com.roxstar.voice.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.roxstar.voice.MainActivity
import com.roxstar.voice.RoxStarApp
import com.roxstar.voice.data.remote.ApiException
import com.roxstar.voice.data.remote.CreateUserRequest
import com.roxstar.voice.databinding.FragmentNameSetupBinding
import kotlinx.coroutines.launch

class NameSetupFragment : Fragment() {
    private var binding: FragmentNameSetupBinding? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        val view = FragmentNameSetupBinding.inflate(inflater, container, false)
        binding = view
        val app = RoxStarApp.instance
        view.apiUrl.setText(app.session.apiBaseUrl)
        view.createUser.setOnClickListener {
            val name = view.userName.text?.toString()?.trim().orEmpty()
            if (name.isEmpty()) {
                Toast.makeText(requireContext(), "Enter your name.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            app.applyApiBaseUrl(view.apiUrl.text?.toString().orEmpty())
            view.createUser.isEnabled = false
            view.status.text = "Creating user..."
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val user = app.api.call { createUser(CreateUserRequest(name)) }
                    app.session.userId = user.id
                    app.session.userName = user.name
                    (activity as MainActivity).open(HomeFragment(), addToBackStack = false)
                } catch (error: ApiException) {
                    view.status.text = error.message
                    Toast.makeText(requireContext(), error.message, Toast.LENGTH_LONG).show()
                } finally {
                    view.createUser.isEnabled = true
                }
            }
        }
        return view.root
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }
}
