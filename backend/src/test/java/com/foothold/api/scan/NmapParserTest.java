package com.foothold.api.scan;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Mirrors the detect() tests in test/core.test.js so the browser and the API behave the same. */
class NmapParserTest {

    private static final Map<Integer, String> SERVICES = Map.of(22, "SSH", 445, "SMB", 3389, "RDP", 5985, "WinRM", 6379, "Redis");
    private static final Map<String, Integer> ALIASES = new LinkedHashMap<>();

    static {
        ALIASES.put("ssh", 22);
        ALIASES.put("redis", 6379);
        ALIASES.put("winrm", 5985);
    }

    private final NmapParser parser = new NmapParser(SERVICES, ALIASES);

    private static final String NMAP = String.join("\n",
            "Starting Nmap 7.94 ( https://nmap.org )",
            "Nmap scan report for dc01.corp.local (10.10.11.42)",
            "PORT     STATE    SERVICE       VERSION",
            "22/tcp   open     ssh           OpenSSH 8.9p1 Ubuntu 3ubuntu0.6",
            "80/tcp   open     http          nginx 1.18.0",
            "135/tcp  filtered msrpc",
            "445/tcp  open     microsoft-ds?",
            "5985/tcp open     http          Microsoft HTTPAPI httpd 2.0",
            "");

    private static List<Integer> ports(NmapParser.Result r) {
        return r.ports().stream().map(DetectedPort::port).toList();
    }

    @Test
    void readsOpenPortsServicesAndProductsFromNmapOutput() {
        NmapParser.Result r = parser.parse(NMAP);
        assertEquals("10.10.11.42", r.ip());
        assertEquals(List.of(22, 80, 445, 5985), ports(r));
        DetectedPort ssh = r.ports().get(0);
        assertEquals("tcp", ssh.proto());
        assertEquals("ssh", ssh.service());
        assertEquals("OpenSSH 8.9p1 Ubuntu 3ubuntu0.6", ssh.product());
        assertEquals("", r.ports().get(2).product());
    }

    @Test
    void doesNotSwallowTheNextLineWhenThereIsNoVersionColumn() {
        NmapParser.Result r = parser.parse("445/tcp open microsoft-ds\n5985/tcp open http Microsoft HTTPAPI");
        assertEquals(List.of(445, 5985), ports(r));
        assertEquals("", r.ports().get(0).product());
    }

    @Test
    void handlesWindowsLineEndings() {
        NmapParser.Result r = parser.parse("445/tcp open microsoft-ds\r\n5985/tcp open http Microsoft HTTPAPI\r\n");
        assertEquals(List.of(445, 5985), ports(r));
        assertEquals("Microsoft HTTPAPI", r.ports().get(1).product());
    }

    @Test
    void ignoresFilteredPorts() {
        assertTrue(ports(parser.parse(NMAP)).stream().noneMatch(p -> p == 135));
    }

    @Test
    void rejectsAnIpWithAnOctetAbove255() {
        assertNull(parser.parse("Nmap scan report for 10.10.300.1\n22/tcp open ssh").ip());
    }

    @Test
    void fallsBackToBarePortNumbers() {
        NmapParser.Result r = parser.parse("22, 445 and 3389");
        assertNull(r.ip());
        assertEquals(List.of(22, 445, 3389), ports(r));
        assertEquals("ssh", r.ports().get(0).service());
    }

    @Test
    void mapsServiceNamesToPorts() {
        assertEquals(List.of(5985, 6379), ports(parser.parse("there is redis and winrm on this box")));
    }

    @Test
    void dropsOutOfRangePorts() {
        assertEquals(List.of(8080), ports(parser.parse("0 70000 8080")));
    }

    @Test
    void handlesEmptyAndNullInput() {
        assertEquals(List.of(), parser.parse("").ports());
        assertEquals(List.of(), parser.parse(null).ports());
    }
}
