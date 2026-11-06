package com.foothold.api.catalog;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.QueryValue;
import io.micronaut.http.exceptions.HttpStatusException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

@Controller("/api/commands")
public class CommandController {

    private final CommandCatalog catalog;

    public CommandController(CommandCatalog catalog) {
        this.catalog = catalog;
    }

    /** GET /api/commands?phase=enum&port=445&os=windows&q=smb */
    @Get
    public List<Command> list(@QueryValue @Nullable String phase,
                              @QueryValue @Nullable @Min(1) @Max(65535) Integer port,
                              @QueryValue @Nullable String os,
                              @QueryValue @Nullable @Size(max = 100) String q) {
        if (phase != null && !catalog.phases().contains(phase)) {
            throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Unknown phase: " + phase);
        }
        return catalog.search(phase, port, os, q);
    }

    @Get("/{id}")
    public Command get(String id) {
        return catalog.find(id).orElseThrow(() -> new HttpStatusException(HttpStatus.NOT_FOUND, "No command " + id));
    }
}
