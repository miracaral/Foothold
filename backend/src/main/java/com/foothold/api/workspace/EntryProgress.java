package com.foothold.api.workspace;

import io.micronaut.data.annotation.GeneratedValue;
import io.micronaut.data.annotation.Id;
import io.micronaut.data.annotation.MappedEntity;

/** A row means the command is marked done in this workspace. */
@MappedEntity("entry_progress")
public class EntryProgress {

    @Id
    @GeneratedValue(GeneratedValue.Type.IDENTITY)
    private Long id;
    private String workspaceId;
    private String entryId;

    public EntryProgress() {
    }

    public EntryProgress(String workspaceId, String entryId) {
        this.workspaceId = workspaceId;
        this.entryId = entryId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
    public String getEntryId() { return entryId; }
    public void setEntryId(String entryId) { this.entryId = entryId; }
}
