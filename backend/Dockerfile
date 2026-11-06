# Build stage: compile and package a runnable fat jar.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -ntp -q dependency:go-offline || true
COPY src src
RUN mvn -B -ntp -DskipTests package

# Runtime stage: JRE only, non-root user.
FROM eclipse-temurin:17-jre
LABEL org.opencontainers.image.title="foothold-api" \
      org.opencontainers.image.description="Java 17 / Micronaut REST API for Foothold: command catalogue, Nmap scan parsing and per-user workspaces on Oracle Database." \
      org.opencontainers.image.source="https://github.com/miracaral/Foothold" \
      org.opencontainers.image.licenses="MIT"
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build /src/target/foothold-api.jar foothold-api.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Djava.io.tmpdir=/tmp", "-jar", "/app/foothold-api.jar"]
