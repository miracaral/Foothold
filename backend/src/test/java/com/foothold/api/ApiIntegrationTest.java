package com.foothold.api;

import com.foothold.api.catalog.Command;
import com.foothold.api.scan.ScanController.ScanResponse;
import com.foothold.api.workspace.WorkspaceView;
import io.micronaut.core.type.Argument;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.client.BlockingHttpClient;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import io.micronaut.test.support.TestPropertyProvider;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Runs the whole API over HTTP against a real Oracle Database, with the schema applied by Flyway. */
@MicronautTest(transactional = false)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiIntegrationTest implements TestPropertyProvider {

    @Inject
    @Client("/")
    HttpClient httpClient;

    @Override
    public Map<String, String> getProperties() {
        return OracleTestDatabase.properties();
    }

    private BlockingHttpClient http() {
        return httpClient.toBlocking();
    }

    private HttpStatus statusOf(HttpRequest<?> request) {
        HttpClientResponseException e = assertThrows(HttpClientResponseException.class, () -> http().exchange(request));
        return e.getStatus();
    }

    private WorkspaceView newWorkspace() {
        HttpResponse<WorkspaceView> r = http().exchange(HttpRequest.POST("/api/workspaces", ""), WorkspaceView.class);
        assertEquals(HttpStatus.CREATED, r.getStatus());
        return r.body();
    }

    private static Map<String, Object> command(String title, String cmd) {
        Map<String, Object> c = new HashMap<>();
        c.put("phase", "privesc");
        c.put("title", title);
        c.put("cmd", cmd);
        return c;
    }

    // ---------- health ----------

    @Test
    void healthReportsUpIncludingTheDatabase() {
        String body = http().retrieve("/health");
        assertTrue(body.contains("\"status\":\"UP\""), body);
    }

    // ---------- catalogue ----------

    @Test
    void servesTheWholeCatalogue() {
        List<Command> all = http().retrieve(HttpRequest.GET("/api/commands"), Argument.listOf(Command.class));
        assertEquals(77, all.size());
        assertTrue(all.stream().noneMatch(Command::custom));
    }

    @Test
    void filtersByPortPhaseAndQuery() {
        List<Command> smb = http().retrieve(HttpRequest.GET("/api/commands?port=445"), Argument.listOf(Command.class));
        assertFalse(smb.isEmpty());
        assertTrue(smb.stream().allMatch(c -> c.ports().contains(445)));

        List<Command> recon = http().retrieve(HttpRequest.GET("/api/commands?phase=recon&q=nmap"), Argument.listOf(Command.class));
        assertFalse(recon.isEmpty());
        assertTrue(recon.stream().allMatch(c -> c.phase().equals("recon")));
    }

    @Test
    void rejectsAnUnknownPhaseAndAnInvalidPort() {
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.GET("/api/commands?phase=pwn")));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.GET("/api/commands?port=70000")));
    }

    @Test
    void returnsOneCommandOr404() {
        assertEquals("e0", http().retrieve(HttpRequest.GET("/api/commands/e0"), Command.class).id());
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.GET("/api/commands/e9999")));
    }

    // ---------- scan ----------

    @Test
    void scanReturnsCommandsForEveryOpenPort() {
        String nmap = "Nmap scan report for dc01 (10.10.11.42)\n445/tcp open microsoft-ds\n5985/tcp open http Microsoft HTTPAPI";
        ScanResponse r = http().retrieve(HttpRequest.POST("/api/scan", Map.of("text", nmap)), ScanResponse.class);
        assertEquals("10.10.11.42", r.ip());
        assertEquals(List.of(445, 5985), r.ports().stream().map(p -> p.port().port()).toList());
        assertTrue(r.ports().stream().allMatch(p -> !p.commands().isEmpty()));
        assertEquals("WinRM", r.ports().get(1).serviceName());
    }

    @Test
    void scanRejectsBlankText() {
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.POST("/api/scan", Map.of("text", " "))));
    }

    // ---------- workspaces (stored in Oracle) ----------

    @Test
    void createsAnEmptyWorkspace() {
        WorkspaceView ws = newWorkspace();
        assertNotNull(ws.id());
        assertNotNull(ws.createdAt());
        assertTrue(ws.custom().isEmpty());
        assertTrue(ws.notes().isEmpty());
        assertTrue(ws.done().isEmpty());
        assertTrue(ws.vars().isEmpty());
    }

    @Test
    void storesCustomCommandsWithDefaults() {
        String id = newWorkspace().id();
        Map<String, Object> body = command("SUID binaries", "find / -perm -4000 2>/dev/null");
        body.put("ports", List.of(22, 22));
        body.put("sourceUrl", "https://www.gtfobins.github.io/");

        HttpResponse<Command> created = http().exchange(HttpRequest.POST("/api/workspaces/" + id + "/commands", body), Command.class);
        assertEquals(HttpStatus.CREATED, created.getStatus());
        Command c = created.body();
        assertTrue(c.id().startsWith("w"));
        assertTrue(c.custom());
        assertEquals("Custom", c.category());
        assertEquals(List.of("any"), c.tags());
        assertEquals(List.of(22), c.ports());
        assertEquals("gtfobins.github.io", c.source().title());

        WorkspaceView ws = http().retrieve(HttpRequest.GET("/api/workspaces/" + id), WorkspaceView.class);
        assertEquals(List.of(c), ws.custom());
    }

    @Test
    void rejectsInvalidCustomCommands() {
        String path = "/api/workspaces/" + newWorkspace().id() + "/commands";

        Map<String, Object> badPhase = command("t", "c");
        badPhase.put("phase", "pwn");
        Map<String, Object> badPort = command("t", "c");
        badPort.put("ports", List.of(70000));
        Map<String, Object> badTag = command("t", "c");
        badTag.put("tags", List.of("macos"));
        Map<String, Object> noCmd = command("t", " ");
        Map<String, Object> badUrl = command("t", "c");
        badUrl.put("sourceUrl", "javascript:alert(1)");

        for (Map<String, Object> bad : List.of(badPhase, badPort, badTag, noCmd, badUrl)) {
            assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.POST(path, bad)), bad.toString());
        }
        WorkspaceView ws = http().retrieve(HttpRequest.GET(path.replace("/commands", "")), WorkspaceView.class);
        assertTrue(ws.custom().isEmpty());
    }

    @Test
    void deletingACommandAlsoRemovesItsNoteAndProgress() {
        String id = newWorkspace().id();
        Command c = http().retrieve(HttpRequest.POST("/api/workspaces/" + id + "/commands", command("t", "c")), Command.class);
        long number = Long.parseLong(c.id().substring(1));
        http().exchange(HttpRequest.PUT("/api/workspaces/" + id + "/notes/" + c.id(), Map.of("text", "note")));
        http().exchange(HttpRequest.PUT("/api/workspaces/" + id + "/done/" + c.id(), ""));

        assertEquals(HttpStatus.NO_CONTENT, http().exchange(HttpRequest.DELETE("/api/workspaces/" + id + "/commands/" + number)).getStatus());
        WorkspaceView ws = http().retrieve(HttpRequest.GET("/api/workspaces/" + id), WorkspaceView.class);
        assertTrue(ws.custom().isEmpty());
        assertTrue(ws.notes().isEmpty());
        assertTrue(ws.done().isEmpty());

        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.DELETE("/api/workspaces/" + id + "/commands/" + number)));
    }

    @Test
    void aCommandCannotBeDeletedThroughAnotherWorkspace() {
        String owner = newWorkspace().id();
        String other = newWorkspace().id();
        Command c = http().retrieve(HttpRequest.POST("/api/workspaces/" + owner + "/commands", command("t", "c")), Command.class);
        String number = c.id().substring(1);
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.DELETE("/api/workspaces/" + other + "/commands/" + number)));
        assertEquals(1, http().retrieve(HttpRequest.GET("/api/workspaces/" + owner), WorkspaceView.class).custom().size());
    }

    @Test
    void notesAreCreatedUpdatedAndDeleted() {
        String base = "/api/workspaces/" + newWorkspace().id();
        http().exchange(HttpRequest.PUT(base + "/notes/e3", Map.of("text", "first")));
        http().exchange(HttpRequest.PUT(base + "/notes/e3", Map.of("text", "second")));
        assertEquals(Map.of("e3", "second"), http().retrieve(HttpRequest.GET(base), WorkspaceView.class).notes());

        http().exchange(HttpRequest.DELETE(base + "/notes/e3"));
        assertTrue(http().retrieve(HttpRequest.GET(base), WorkspaceView.class).notes().isEmpty());

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.PUT(base + "/notes/e3", Map.of("text", ""))));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.PUT(base + "/notes/bad%20id", Map.of("text", "x"))));
    }

    @Test
    void progressIsIdempotent() {
        String base = "/api/workspaces/" + newWorkspace().id();
        http().exchange(HttpRequest.PUT(base + "/done/e1", ""));
        http().exchange(HttpRequest.PUT(base + "/done/e1", ""));
        http().exchange(HttpRequest.PUT(base + "/done/e2", ""));
        assertEquals(List.of("e1", "e2"), http().retrieve(HttpRequest.GET(base), WorkspaceView.class).done());

        http().exchange(HttpRequest.DELETE(base + "/done/e1"));
        http().exchange(HttpRequest.DELETE(base + "/done/e1"));
        assertEquals(List.of("e2"), http().retrieve(HttpRequest.GET(base), WorkspaceView.class).done());
    }

    @Test
    void targetValuesMergeAndOnlyKnownFieldsAreAccepted() {
        String base = "/api/workspaces/" + newWorkspace().id();
        http().exchange(HttpRequest.PUT(base + "/vars", Map.of("IP", "10.10.11.42", "USER", "bob")));
        http().exchange(HttpRequest.PUT(base + "/vars", Map.of("USER", "", "DOMAIN", "corp.local")));
        assertEquals(Map.of("IP", "10.10.11.42", "DOMAIN", "corp.local"),
                http().retrieve(HttpRequest.GET(base), WorkspaceView.class).vars());

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.PUT(base + "/vars", Map.of("SHELL", "x"))));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(HttpRequest.PUT(base + "/vars", Map.of("IP", "1".repeat(501)))));
    }

    @Test
    void deletingAWorkspaceRemovesEverythingInIt() {
        String id = newWorkspace().id();
        http().exchange(HttpRequest.POST("/api/workspaces/" + id + "/commands", command("t", "c")));
        http().exchange(HttpRequest.PUT("/api/workspaces/" + id + "/notes/e1", Map.of("text", "n")));
        assertEquals(HttpStatus.NO_CONTENT, http().exchange(HttpRequest.DELETE("/api/workspaces/" + id)).getStatus());
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.GET("/api/workspaces/" + id)));
    }

    @Test
    void unknownWorkspaceIs404Everywhere() {
        String base = "/api/workspaces/00000000-0000-0000-0000-000000000000";
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.GET(base)));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.POST(base + "/commands", command("t", "c"))));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.PUT(base + "/done/e1", "")));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(HttpRequest.PUT(base + "/vars", Map.of("IP", "1.1.1.1"))));
    }

    @Test
    void allowsCrossOriginRequestsFromTheStaticFrontEnd() {
        HttpResponse<?> r = http().exchange(HttpRequest.OPTIONS("/api/commands")
                .header("Origin", "null")
                .header("Access-Control-Request-Method", "GET"));
        assertEquals(HttpStatus.OK, r.getStatus());
        assertNotNull(r.getHeaders().get("Access-Control-Allow-Origin"));
    }
}
