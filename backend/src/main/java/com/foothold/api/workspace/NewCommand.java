package com.foothold.api.workspace;

import io.micronaut.core.annotation.Introspected;
import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Request body for adding a custom command. Same rules as normalizeEntry in js/core.js. */
@Serdeable
@Introspected
public record NewCommand(
        @NotBlank @Pattern(regexp = "recon|enum|access|privesc|lateral|web|post") String phase,
        @Nullable @Size(max = 80) String category,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String cmd,
        @Nullable @Size(max = 2000) String note,
        @Nullable @Size(max = 6) List<@NotNull @Pattern(regexp = "linux|windows|ad|web|net|any") String> tags,
        @Nullable @Size(max = 50) List<@NotNull @Min(1) @Max(65535) Integer> ports,
        @Nullable @Size(max = 1000) @Pattern(regexp = "https?://\\S+") String sourceUrl) {
}
