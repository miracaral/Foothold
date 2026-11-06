package com.foothold.api.scan;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;

@Serdeable
public record DetectedPort(int port, @Nullable String proto, String service, String product) {
}
