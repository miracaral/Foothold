package com.foothold.api.catalog;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;

import java.util.List;
import java.util.Map;

/** Shape of catalogue.json, generated from js/data.js by scripts/export-catalogue.js. */
@Serdeable
record CatalogueFile(
        List<String> vars,
        List<String> phases,
        Map<String, String> services,
        Map<String, Integer> aliases,
        List<Entry> entries) {

    @Serdeable
    record Entry(
            String id,
            String phase,
            String category,
            String title,
            String cmd,
            String note,
            List<String> tags,
            List<Integer> ports,
            @Nullable Source source) {
    }
}
