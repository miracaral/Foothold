package com.foothold.api.workspace;

import io.micronaut.data.annotation.DateCreated;
import io.micronaut.data.annotation.Id;
import io.micronaut.data.annotation.MappedEntity;

import java.time.Instant;

@MappedEntity("workspace")
public class Workspace {

    @Id
    private String id;
    private String varsJson = "{}";
    @DateCreated
    private Instant createdAt;

    public Workspace() {
    }

    public Workspace(String id) {
        this.id = id;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getVarsJson() { return varsJson; }
    public void setVarsJson(String varsJson) { this.varsJson = varsJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
