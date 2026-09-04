plugins {
  alias(libs.plugins.android.application) apply false
  alias(libs.plugins.kotlin.android) apply false
  alias(libs.plugins.kotlin.serialization) apply false
  alias(libs.plugins.kotlin.kapt) apply false
  alias(libs.plugins.hilt) apply false
}

tasks.register("test") {
  group = "verification"
  description = "Runs Android JVM verification tasks."
  dependsOn(":app:runUnitTests")
}
