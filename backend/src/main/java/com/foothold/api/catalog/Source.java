package com.foothold.api.catalog;

import io.micronaut.serde.annotation.Serdeable;

/** Where a command comes from, e.g. HackTricks or the tool's docs. */
@Serdeable
public record Source(String title, String url) {
}
