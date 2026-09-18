package com.roxstar.voice.data.remote

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(
    val code: String,
    override val message: String,
    val httpStatus: Int
) : Exception(message)

class ApiClient(initialBaseUrl: String) {
    val gson: Gson = GsonBuilder().create()

    @Volatile
    var baseUrl: String = normalize(initialBaseUrl)
        private set

    @Volatile
    lateinit var service: ApiService
        private set

    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .callTimeout(15, TimeUnit.SECONDS)
        .addInterceptor(
            HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        )
        .build()

    init {
        rebuild(initialBaseUrl)
    }

    fun rebuild(url: String) {
        baseUrl = normalize(url)
        service = Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(http)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }

    suspend fun <T> call(block: suspend ApiService.() -> T): T {
        try {
            return service.block()
        } catch (error: HttpException) {
            val parsed = runCatching {
                gson.fromJson(error.response()?.errorBody()?.string(), ApiErrorBody::class.java)
            }.getOrNull()
            throw ApiException(
                parsed?.error?.code ?: "HTTP_${error.code()}",
                parsed?.error?.message ?: "Request failed (${error.code()}).",
                error.code()
            )
        } catch (error: IOException) {
            throw ApiException("NETWORK_ERROR", "Backend is unavailable. Check the API URL and that the server is running.", 0)
        } catch (error: ApiException) {
            throw error
        } catch (error: Exception) {
            throw ApiException("CLIENT_ERROR", error.message ?: "Unexpected client error.", 0)
        }
    }

    private fun normalize(url: String): String = url.trim().trimEnd('/')
}
