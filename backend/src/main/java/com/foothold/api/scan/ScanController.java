package com.foothold.api.scan;

import com.foothold.api.catalog.Command;
import com.foothold.api.catalog.CommandCatalog;
import io.micronaut.core.annotation.Nullable;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Post;
import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Controller("/api/scan")
public class ScanController {

    private final CommandCatalog catalog;
    private final NmapParser parser;

    public ScanController(CommandCatalog catalog) {
        this.catalog = catalog;
        this.parser = new NmapParser(catalog.services(), catalog.aliases());
    }

    @Serdeable
    public record ScanRequest(@NotBlank @Size(max = 200_000) String text) {
    }

    @Serdeable
    public record PortCommands(DetectedPort port, String serviceName, List<Command> commands) {
    }

    @Serdeable
    public record ScanResponse(@Nullable String ip, List<PortCommands> ports) {
    }

    /** POST /api/scan {"text": "<nmap -sV output>"} returns the commands for every open port. */
    @Post
    public ScanResponse scan(@Body @Valid ScanRequest request) {
        NmapParser.Result result = parser.parse(request.text());
        List<PortCommands> ports = result.ports().stream()
                .map(p -> new PortCommands(p, catalog.services().getOrDefault(p.port(), p.service()), catalog.forPort(p.port())))
                .toList();
        return new ScanResponse(result.ip(), ports);
    }
}
