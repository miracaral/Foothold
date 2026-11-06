package com.foothold.api.workspace;

import io.micronaut.data.jdbc.annotation.JdbcRepository;
import io.micronaut.data.model.query.builder.sql.Dialect;
import io.micronaut.data.repository.CrudRepository;

import java.util.List;
import java.util.Optional;

@JdbcRepository(dialect = Dialect.ORACLE)
public interface EntryProgressRepository extends CrudRepository<EntryProgress, Long> {
    List<EntryProgress> findByWorkspaceId(String workspaceId);

    boolean existsByWorkspaceIdAndEntryId(String workspaceId, String entryId);

    void deleteByWorkspaceIdAndEntryId(String workspaceId, String entryId);
}
