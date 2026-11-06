package com.foothold.api.catalog;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;

import java.util.List;

/**
 * One command card. Built-in ids look like {@code e12}; commands stored in a workspace look like {@code w5}.
 */
@Serdeable
public record Command(
        String id,
        String phase,
        String category,
        String title,
        String cmd,
        String note,
        List<String> tags,
        List<Integer> ports,
        @Nullable Source source,
        boolean custom) {

    public boolean coversPort(int port) {
        return ports.contains(port);
    }

    public boolean matchesOs(String os) {
        return os == null || os.isBlank() || "all".equals(os) || tags.contains(os) || tags.contains("any");
    }

    public boolean matchesQuery(String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String haystack = String.join(" ", title, note, cmd, String.join(" ", tags), category);
        return haystack.toLowerCase().contains(query.toLowerCase());
    }
}
