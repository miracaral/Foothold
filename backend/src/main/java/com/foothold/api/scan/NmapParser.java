package com.foothold.api.scan;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds open ports and the target IP in pasted text. Java port of {@code detect} in js/core.js,
 * so the browser and the API agree on what a scan contains.
 */
public final class NmapParser {

    /** "445/tcp open microsoft-ds Samba 4" — [ \t] instead of \s so a line never runs into the next one. */
    private static final Pattern NMAP_LINE = Pattern.compile(
            "^[ \\t]*(\\d{1,5})/(tcp|udp)[ \\t]+open[ \\t]+(\\S+)(?:[ \\t]+(.*))?$",
            Pattern.MULTILINE | Pattern.CASE_INSENSITIVE);

    /** Fallback: "22 ssh", "445/tcp", or bare numbers. */
    private static final Pattern BARE_PORT = Pattern.compile(
            "\\b(\\d{1,5})\\b(?:[/\\s]+(?:tcp|udp)\\b)?(?:\\s+([a-z][a-z0-9_./-]{1,24}))?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern TARGET_IP = Pattern.compile(
            "(?:scan report for|for)\\s+(?:[\\w.-]+\\s+\\()?(\\d{1,3}(?:\\.\\d{1,3}){3})\\)?",
            Pattern.CASE_INSENSITIVE);

    private final Map<Integer, String> services;
    private final Map<String, Integer> aliases;

    public NmapParser(Map<Integer, String> services, Map<String, Integer> aliases) {
        this.services = services;
        this.aliases = aliases;
    }

    public record Result(String ip, List<DetectedPort> ports) {
    }

    public Result parse(String text) {
        String input = text == null ? "" : text;
        Map<Integer, DetectedPort> found = new LinkedHashMap<>();

        Matcher m = NMAP_LINE.matcher(input);
        while (m.find()) {
            int port = toPort(m.group(1));
            if (port > 0) {
                String product = m.group(4) == null ? "" : m.group(4).trim();
                found.putIfAbsent(port, new DetectedPort(port, m.group(2).toLowerCase(Locale.ROOT), m.group(3), product));
            }
        }

        if (found.isEmpty()) {
            Matcher b = BARE_PORT.matcher(input);
            while (b.find()) {
                int port = toPort(b.group(1));
                if (port > 0) {
                    String service = b.group(2) != null ? b.group(2) : services.getOrDefault(port, "");
                    found.putIfAbsent(port, new DetectedPort(port, null, service.toLowerCase(Locale.ROOT), ""));
                }
            }
            String lower = " " + input.toLowerCase(Locale.ROOT) + " ";
            aliases.forEach((name, port) -> {
                if (lower.contains(name)) {
                    found.putIfAbsent(port, new DetectedPort(port, null, name, ""));
                }
            });
        }

        List<DetectedPort> ports = new ArrayList<>(found.values());
        ports.sort(Comparator.comparingInt(DetectedPort::port));
        return new Result(findIp(input), List.copyOf(ports));
    }

    private static int toPort(String digits) {
        int p = Integer.parseInt(digits);
        return p >= 1 && p <= 65535 ? p : -1;
    }

    private static String findIp(String input) {
        Matcher m = TARGET_IP.matcher(input);
        if (!m.find()) {
            return null;
        }
        String ip = m.group(1);
        for (String octet : ip.split("\\.")) {
            if (Integer.parseInt(octet) > 255) {
                return null;
            }
        }
        return ip;
    }
}
