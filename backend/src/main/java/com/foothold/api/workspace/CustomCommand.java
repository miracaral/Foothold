package com.foothold.api.workspace;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.data.annotation.DateCreated;
import io.micronaut.data.annotation.GeneratedValue;
import io.micronaut.data.annotation.Id;
import io.micronaut.data.annotation.MappedEntity;

import java.time.Instant;

/** A command a person added themselves. Tags and ports are stored as comma-separated lists. */
@MappedEntity("custom_command")
public class CustomCommand {

    @Id
    @GeneratedValue(GeneratedValue.Type.IDENTITY)
    private Long id;
    private String workspaceId;
    private String phase;
    private String category;
    private String title;
    private String cmd;
    @Nullable
    private String note;
    private String tags;
    @Nullable
    private String ports;
    @Nullable
    private String sourceTitle;
    @Nullable
    private String sourceUrl;
    @DateCreated
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCmd() { return cmd; }
    public void setCmd(String cmd) { this.cmd = cmd; }
    @Nullable public String getNote() { return note; }
    public void setNote(@Nullable String note) { this.note = note; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    @Nullable public String getPorts() { return ports; }
    public void setPorts(@Nullable String ports) { this.ports = ports; }
    @Nullable public String getSourceTitle() { return sourceTitle; }
    public void setSourceTitle(@Nullable String sourceTitle) { this.sourceTitle = sourceTitle; }
    @Nullable public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(@Nullable String sourceUrl) { this.sourceUrl = sourceUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
