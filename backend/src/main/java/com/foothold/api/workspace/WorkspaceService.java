package com.foothold.api.workspace;

import com.foothold.api.catalog.Command;
import com.foothold.api.catalog.CommandCatalog;
import com.foothold.api.catalog.Source;
import io.micronaut.core.type.Argument;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.exceptions.HttpStatusException;
import io.micronaut.serde.ObjectMapper;
import io.micronaut.transaction.annotation.ReadOnly;
import io.micronaut.transaction.annotation.Transactional;
import jakarta.inject.Singleton;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Singleton
public class WorkspaceService {

    /** Built-in ("e12"), stored ("w5") and browser-only ("c0_1730000000") command ids. */
    private static final Pattern ENTRY_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final int MAX_VAR_LENGTH = 500;
    private static final int MAX_COMMANDS_PER_WORKSPACE = 500;

    private final WorkspaceRepository workspaces;
    private final CustomCommandRepository commands;
    private final EntryNoteRepository notes;
    private final EntryProgressRepository progress;
    private final CommandCatalog catalog;
    private final ObjectMapper json;

    public WorkspaceService(WorkspaceRepository workspaces, CustomCommandRepository commands,
                            EntryNoteRepository notes, EntryProgressRepository progress,
                            CommandCatalog catalog, ObjectMapper json) {
        this.workspaces = workspaces;
        this.commands = commands;
        this.notes = notes;
        this.progress = progress;
        this.catalog = catalog;
        this.json = json;
    }

    @Transactional
    public WorkspaceView create() {
        Workspace ws = workspaces.save(new Workspace(UUID.randomUUID().toString()));
        return view(ws);
    }

    @ReadOnly
    public WorkspaceView get(String id) {
        return view(require(id));
    }

    @Transactional
    public void delete(String id) {
        workspaces.delete(require(id));
    }

    @Transactional
    public Command addCommand(String workspaceId, NewCommand in) {
        require(workspaceId);
        if (commands.findByWorkspaceIdOrderById(workspaceId).size() >= MAX_COMMANDS_PER_WORKSPACE) {
            throw new HttpStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Workspace is full");
        }
        CustomCommand c = new CustomCommand();
        c.setWorkspaceId(workspaceId);
        c.setPhase(in.phase());
        c.setCategory(blankToDefault(in.category(), "Custom"));
        c.setTitle(in.title().trim());
        c.setCmd(in.cmd().trim());
        c.setNote(blankToDefault(in.note(), null));
        List<String> tags = in.tags() == null || in.tags().isEmpty() ? List.of("any") : in.tags().stream().distinct().toList();
        c.setTags(String.join(",", tags));
        if (in.ports() != null && !in.ports().isEmpty()) {
            c.setPorts(in.ports().stream().distinct().sorted().map(String::valueOf).collect(Collectors.joining(",")));
        }
        if (in.sourceUrl() != null && !in.sourceUrl().isBlank()) {
            c.setSourceUrl(in.sourceUrl().trim());
            c.setSourceTitle(hostOf(in.sourceUrl().trim()));
        }
        return toCommand(commands.save(c));
    }

    @Transactional
    public void deleteCommand(String workspaceId, long commandId) {
        require(workspaceId);
        CustomCommand c = commands.findByIdAndWorkspaceId(commandId, workspaceId)
                .orElseThrow(() -> new HttpStatusException(HttpStatus.NOT_FOUND, "No such command"));
        String entryId = "w" + c.getId();
        notes.deleteByWorkspaceIdAndEntryId(workspaceId, entryId);
        progress.deleteByWorkspaceIdAndEntryId(workspaceId, entryId);
        commands.delete(c);
    }

    @Transactional
    public void putNote(String workspaceId, String entryId, String body) {
        require(workspaceId);
        checkEntryId(entryId);
        EntryNote note = notes.findByWorkspaceIdAndEntryId(workspaceId, entryId)
                .orElseGet(() -> new EntryNote(workspaceId, entryId, body));
        note.setBody(body);
        if (note.getId() == null) {
            notes.save(note);
        } else {
            notes.update(note);
        }
    }

    @Transactional
    public void deleteNote(String workspaceId, String entryId) {
        require(workspaceId);
        checkEntryId(entryId);
        notes.deleteByWorkspaceIdAndEntryId(workspaceId, entryId);
    }

    @Transactional
    public void setDone(String workspaceId, String entryId, boolean done) {
        require(workspaceId);
        checkEntryId(entryId);
        boolean exists = progress.existsByWorkspaceIdAndEntryId(workspaceId, entryId);
        if (done && !exists) {
            progress.save(new EntryProgress(workspaceId, entryId));
        } else if (!done && exists) {
            progress.deleteByWorkspaceIdAndEntryId(workspaceId, entryId);
        }
    }

    /** Merges target values; an empty string removes a value. Only fields the UI knows are accepted. */
    @Transactional
    public Map<String, String> putVars(String workspaceId, Map<String, String> changes) {
        Workspace ws = require(workspaceId);
        Map<String, String> vars = readVars(ws);
        changes.forEach((key, value) -> {
            if (!catalog.vars().contains(key)) {
                throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Unknown target field: " + key);
            }
            if (value == null || value.isBlank()) {
                vars.remove(key);
            } else if (value.length() > MAX_VAR_LENGTH) {
                throw new HttpStatusException(HttpStatus.BAD_REQUEST, key + " is too long");
            } else {
                vars.put(key, value.trim());
            }
        });
        ws.setVarsJson(writeVars(vars));
        workspaces.update(ws);
        return vars;
    }

    private Workspace require(String id) {
        return workspaces.findById(id)
                .orElseThrow(() -> new HttpStatusException(HttpStatus.NOT_FOUND, "No such workspace"));
    }

    private static void checkEntryId(String entryId) {
        if (entryId == null || !ENTRY_ID.matcher(entryId).matches()) {
            throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Invalid command id");
        }
    }

    private WorkspaceView view(Workspace ws) {
        String id = ws.getId();
        List<Command> custom = commands.findByWorkspaceIdOrderById(id).stream().map(WorkspaceService::toCommand).toList();
        Map<String, String> noteMap = new LinkedHashMap<>();
        notes.findByWorkspaceId(id).forEach(n -> noteMap.put(n.getEntryId(), n.getBody()));
        List<String> done = progress.findByWorkspaceId(id).stream().map(EntryProgress::getEntryId).sorted().toList();
        return new WorkspaceView(id, ws.getCreatedAt(), readVars(ws), custom, noteMap, done);
    }

    static Command toCommand(CustomCommand c) {
        List<String> tags = Arrays.stream(c.getTags().split(",")).filter(s -> !s.isBlank()).toList();
        List<Integer> ports = c.getPorts() == null ? List.of()
                : Arrays.stream(c.getPorts().split(",")).filter(s -> !s.isBlank()).map(Integer::valueOf).toList();
        Source source = c.getSourceUrl() == null ? null : new Source(c.getSourceTitle(), c.getSourceUrl());
        return new Command("w" + c.getId(), c.getPhase(), c.getCategory(), c.getTitle(), c.getCmd(),
                c.getNote() == null ? "" : c.getNote(), tags, ports, source, true);
    }

    private Map<String, String> readVars(Workspace ws) {
        try {
            Map<String, String> vars = json.readValue(ws.getVarsJson(), Argument.mapOf(String.class, String.class));
            return vars == null ? new LinkedHashMap<>() : new LinkedHashMap<>(vars);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String writeVars(Map<String, String> vars) {
        try {
            String out = json.writeValueAsString(vars);
            if (out.length() > 4000) {
                throw new HttpStatusException(HttpStatus.BAD_REQUEST, "Too many target values");
            }
            return out;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String hostOf(String url) {
        try {
            String host = URI.create(url).getHost();
            return host == null ? "source" : host.replaceFirst("^www\\.", "");
        } catch (IllegalArgumentException e) {
            return "source";
        }
    }
}
