plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "cafe.nightingale.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "cafe.nightingale.tv"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sideloaded on the user's own TV: the debug key is enough for now.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// No library on purpose: the app is a launcher, a LAN scanner and a WebView
// (the TV's system Chromium, kept up to date by Google Play).
dependencies {}
