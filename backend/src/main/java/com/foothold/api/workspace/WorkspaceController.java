package com.foothold.api.workspace;

import com.foothold.api.catalog.Command;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import io.micronaut.http.annotation.Status;
import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * A workspace is addressed by an unguessable UUID, like a share link: whoever has the id can read and edit it.
 */
@Controller("/api/workspaces")
public class WorkspaceController {

    private final WorkspaceService service;

    public WorkspaceController(WorkspaceService service) {
        this.service = service;
    }

    @Serdeable
    public record NoteBody(@NotBlank @Size(max = 4000) String text) {
    }

    @Post
    public HttpResponse<WorkspaceView> create() {
        return HttpResponse.created(service.create());
    }

    @Get("/{id}")
    public WorkspaceView get(String id) {
        return service.get(id);
    }

    @Delete("/{id}")
    @Status(HttpStatus.NO_CONTENT)
    public void delete(String id) {
        service.delete(id);
    }

    @Post("/{id}/commands")
    public HttpResponse<Command> addCommand(String id, @Body @Valid NewCommand command) {
        return HttpResponse.created(service.addCommand(id, command));
    }

    /** commandId is the number in "w5". */
    @Delete("/{id}/commands/{commandId}")
    @Status(HttpStatus.NO_CONTENT)
    public void deleteCommand(String id, long commandId) {
        service.deleteCommand(id, commandId);
    }

    @Put("/{id}/notes/{entryId}")
    @Status(HttpStatus.NO_CONTENT)
    public void putNote(String id, String entryId, @Body @Valid NoteBody body) {
        service.putNote(id, entryId, body.text());
    }

    @Delete("/{id}/notes/{entryId}")
    @Status(HttpStatus.NO_CONTENT)
    public void deleteNote(String id, String entryId) {
        service.deleteNote(id, entryId);
    }

    @Put("/{id}/done/{entryId}")
    @Status(HttpStatus.NO_CONTENT)
    public void markDone(String id, String entryId) {
        service.setDone(id, entryId, true);
    }

    @Delete("/{id}/done/{entryId}")
    @Status(HttpStatus.NO_CONTENT)
    public void markNotDone(String id, String entryId) {
        service.setDone(id, entryId, false);
    }

    @Put("/{id}/vars")
    public Map<String, String> putVars(String id, @Body Map<String, String> vars) {
        return service.putVars(id, vars);
    }
}
