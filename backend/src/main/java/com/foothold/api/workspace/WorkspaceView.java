package com.foothold.api.workspace;

import com.foothold.api.catalog.Command;
import io.micronaut.serde.annotation.Serdeable;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Everything stored for one workspace, shaped like the front end's export file. */
@Serdeable
public record WorkspaceView(
        String id,
        Instant createdAt,
        Map<String, String> vars,
        List<Command> custom,
        Map<String, String> notes,
        List<String> done) {
}
