package com.foothold.api.workspace;

import io.micronaut.data.annotation.GeneratedValue;
import io.micronaut.data.annotation.Id;
import io.micronaut.data.annotation.MappedEntity;

@MappedEntity("entry_note")
public class EntryNote {

    @Id
    @GeneratedValue(GeneratedValue.Type.IDENTITY)
    private Long id;
    private String workspaceId;
    private String entryId;
    private String body;

    public EntryNote() {
    }

    public EntryNote(String workspaceId, String entryId, String body) {
        this.workspaceId = workspaceId;
        this.entryId = entryId;
        this.body = body;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
    public String getEntryId() { return entryId; }
    public void setEntryId(String entryId) { this.entryId = entryId; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
