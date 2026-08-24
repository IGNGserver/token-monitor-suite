import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.toolchain.JavaLanguageVersion

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.kotlin.serialization)
  alias(libs.plugins.kotlin.kapt)
  alias(libs.plugins.hilt)
}

android {
  namespace = "com.igng.tokenmonitor.android"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.igng.tokenmonitor.android"
    minSdk = 26
    targetSdk = 36
    val releaseVersion = providers.gradleProperty("tokenMonitorVersion").orElse("0.45.0-rev.16").get()
    versionCode = releaseVersionCode(releaseVersion)
    versionName = releaseVersion
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  buildFeatures { compose = true; buildConfig = true }
  composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }

  buildTypes {
    release {
      isMinifyEnabled = false
      val keystorePath = providers.gradleProperty("androidKeystorePath").orNull
      val keystorePassword = providers.gradleProperty("androidKeystorePassword").orNull
      val keyAlias = providers.gradleProperty("androidKeyAlias").orNull
      val keyPassword = providers.gradleProperty("androidKeyPassword").orNull
      if (keystorePath != null && keystorePassword != null && keyAlias != null && keyPassword != null) {
        signingConfig = signingConfigs.create("releaseSigning").apply {
          storeFile = file(keystorePath)
          storePassword = keystorePassword
          this.keyAlias = keyAlias
          this.keyPassword = keyPassword
        }
      }
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlin { jvmToolchain(17) }
}

private fun releaseVersionCode(version: String): Int {
  val match = Regex("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)-rev\\.([1-9]\\d*)$").matchEntire(version)
    ?: error("Android release version must match <major>.<minor>.<patch>-rev.<revision>: $version")
  val major = match.groupValues[1].toLongOrNull()
    ?: error("Android release major version is too large: $version")
  val minor = match.groupValues[2].toLongOrNull()
    ?: error("Android release minor version is too large: $version")
  val patch = match.groupValues[3].toLongOrNull()
    ?: error("Android release patch version is too large: $version")
  val revision = match.groupValues[4].toLongOrNull()
    ?: error("Android release revision is too large: $version")
  val baseVersionCode = major * 10000L + minor * 100L + patch
  val versionCode = baseVersionCode * 10000L + revision
  require(versionCode in 1..Int.MAX_VALUE.toLong()) {
    "Android versionCode is outside the supported range: $version -> $versionCode"
  }
  return versionCode.toInt()
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.navigation.compose)
  implementation(platform(libs.compose.bom))
  implementation(libs.compose.ui)
  implementation(libs.compose.ui.tooling.preview)
  implementation(libs.compose.material3)
  implementation(libs.compose.material)
  implementation(libs.compose.material.icons)
  implementation(libs.androidx.security.crypto)
  implementation(libs.hilt.android)
  implementation(libs.androidx.hilt.navigation.compose)
  kapt(libs.hilt.compiler)
  implementation(libs.retrofit)
  implementation(libs.retrofit.kotlinx)
  implementation(libs.okhttp)
  implementation(libs.okhttp.sse)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.vico.compose)
  implementation(libs.vico.compose.m3)
  implementation(libs.vico.core)

  testImplementation(libs.junit)
  testImplementation(libs.mockwebserver)
  testImplementation(libs.kotlinx.coroutines.test)
  debugImplementation(libs.compose.ui.tooling)
}

kapt { correctErrorTypes = true }

val repositoryTestOutput = layout.buildDirectory.dir("intermediates/classes/debugUnitTest/transformDebugUnitTestClassesWithAsm/dirs")
val appRuntimeClasses = layout.buildDirectory.dir("intermediates/runtime_app_classes_jar/debug/bundleDebugClassesToRuntimeJar/classes.jar")
val testJavaResources = layout.buildDirectory.dir("intermediates/java_res/debugUnitTest/processDebugUnitTestJavaRes/out")

fun registerJunitCoreTask(name: String, descriptionText: String, vararg testClasses: String) =
  tasks.register(name, Exec::class) {
    group = "verification"
    description = descriptionText
    dependsOn("transformDebugUnitTestClassesWithAsm", "bundleDebugClassesToRuntimeJar", "processDebugUnitTestJavaRes")
    val launcher = javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(21)) }
    val testRuntime = configurations.named("debugUnitTestRuntimeClasspath")
    doFirst {
      val classpath = files(repositoryTestOutput, appRuntimeClasses, testJavaResources, testRuntime)
      commandLine(
        listOf(
          launcher.get().executablePath.asFile.absolutePath,
          "-cp",
          classpath.asPath,
          "org.junit.runner.JUnitCore"
        ) + testClasses
      )
    }
  }

val runRepositoryTests = registerJunitCoreTask(
  "runRepositoryTests",
  "Runs Repository MockWebServer tests without Gradle's Windows argfile worker.",
  "com.igng.tokenmonitor.android.data.repository.HubRepositoryTest"
)

val runHistoryLimitsTests = registerJunitCoreTask(
  "runHistoryLimitsTests",
  "Runs historyPreview/limits DTO parsing tests without Gradle's Windows argfile worker.",
  "com.igng.tokenmonitor.android.data.model.HubDtosHistoryLimitsTest"
)

val runFormattersHelpersTests = registerJunitCoreTask(
  "runFormattersHelpersTests",
  "Runs Formatters helper unit tests without Gradle's Windows argfile worker.",
  "com.igng.tokenmonitor.android.ui.components.FormattersHelpersTest"
)

val runUnitTests = registerJunitCoreTask(
  "runUnitTests",
  "Runs all local unit tests via JUnitCore (Windows argfile workaround).",
  "com.igng.tokenmonitor.android.data.repository.HubRepositoryTest",
  "com.igng.tokenmonitor.android.data.model.HubDtosHistoryLimitsTest",
  "com.igng.tokenmonitor.android.ui.components.FormattersHelpersTest"
)

tasks.withType<Test>().configureEach { enabled = false }
