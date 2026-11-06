package com.foothold.api;

import org.testcontainers.oracle.OracleContainer;

import java.time.Duration;
import java.util.Map;

/** One Oracle Database Free container shared by every integration test in the run. */
public final class OracleTestDatabase {

    private static OracleContainer container;

    private OracleTestDatabase() {
    }

    public static synchronized Map<String, String> properties() {
        if (container == null) {
            container = new OracleContainer("gvenzl/oracle-free:slim-faststart")
                    .withStartupTimeout(Duration.ofMinutes(4));
            container.start();
        }
        return Map.of(
                "datasources.default.url", container.getJdbcUrl(),
                "datasources.default.username", container.getUsername(),
                "datasources.default.password", container.getPassword());
    }
}
