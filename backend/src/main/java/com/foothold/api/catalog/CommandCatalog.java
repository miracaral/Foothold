package com.foothold.api.catalog;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.ObjectMapper;
import jakarta.inject.Singleton;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/** The read-only list of built-in commands, loaded once from catalogue.json on the classpath. */
@Singleton
public class CommandCatalog {

    private final List<Command> commands;
    private final Map<Integer, String> services;
    private final Map<String, Integer> aliases;
    private final List<String> phases;
    private final List<String> vars;

    public CommandCatalog(ObjectMapper objectMapper) {
        CatalogueFile file = read(objectMapper);
        this.commands = file.entries().stream()
                .map(e -> new Command(e.id(), e.phase(), e.category(), e.title(), e.cmd(), e.note(),
                        List.copyOf(e.tags()), List.copyOf(e.ports()), e.source(), false))
                .toList();
        Map<Integer, String> svc = new TreeMap<>();
        file.services().forEach((port, name) -> svc.put(Integer.parseInt(port), name));
        this.services = Map.copyOf(svc);
        this.aliases = new LinkedHashMap<>(file.aliases());
        this.phases = List.copyOf(file.phases());
        this.vars = List.copyOf(file.vars());
    }

    private static CatalogueFile read(ObjectMapper objectMapper) {
        try (InputStream in = CommandCatalog.class.getResourceAsStream("/catalogue.json")) {
            if (in == null) {
                throw new IllegalStateException("catalogue.json not found on the classpath");
            }
            return objectMapper.readValue(in, CatalogueFile.class);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read catalogue.json", e);
        }
    }

    public List<Command> all() {
        return commands;
    }

    public Optional<Command> find(String id) {
        return commands.stream().filter(c -> c.id().equals(id)).findFirst();
    }

    /** Filters combine with AND; a null filter is ignored. */
    public List<Command> search(@Nullable String phase, @Nullable Integer port, @Nullable String os, @Nullable String query) {
        return commands.stream()
                .filter(c -> phase == null || c.phase().equals(phase))
                .filter(c -> port == null || c.coversPort(port))
                .filter(c -> c.matchesOs(os))
                .filter(c -> c.matchesQuery(query))
                .toList();
    }

    public List<Command> forPort(int port) {
        return commands.stream().filter(c -> c.coversPort(port)).toList();
    }

    public Map<Integer, String> services() {
        return services;
    }

    public Map<String, Integer> aliases() {
        return aliases;
    }

    public List<String> phases() {
        return phases;
    }

    public List<String> vars() {
        return vars;
    }
}
