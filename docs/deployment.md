# Deployment record: homelab K3s cluster

Foothold's API and its Oracle database run on my own Kubernetes cluster: the 6-node K3s homelab described in
[homelab-k8s-security](https://github.com/miracaral/homelab-k8s-security) (3 Proxmox VE hosts, Cilium with
WireGuard, Pod Security and network policies). The manifests are the ones in [`k8s/`](../k8s), applied unchanged.

- **First deployed:** 6 November 2026
- **Image:** `ghcr.io/miracaral/foothold-api:latest`, published by CI on every push to `main`
- **Namespace:** `foothold`, Pod Security `restricted`, default-deny network policies

## Pods running

Output of `kubectl -n foothold get pods` on the control-plane node after the rollout:

```
NAME                            READY   STATUS    RESTARTS        AGE
foothold-api-7fdbf59669-k4zq4   1/1     Running   8 (7m50s ago)   20m
foothold-api-7fdbf59669-kkccr   1/1     Running   8 (9m13s ago)   20m
oracle-0                        1/1     Running   0               5m54s
```

The API restarts happened while Oracle was still initializing (see below); once the database was ready the API
connected without intervention.

## End-to-end check through the cluster service

Through `kubectl port-forward svc/foothold-api 8080:80`:

```
$ curl -s http://localhost:8080/health
{"name":"foothold-api","status":"UP", ... "jdbc":{"name":"foothold-api","status":"UP","details":{"jdbc:oracle:thin:@oracle:1521/FREEPDB1":{ ... "database":"Oracle", ... }}}}

$ curl -s -X POST http://localhost:8080/api/workspaces        # created a workspace
$ curl -s -X POST -H 'Content-Type: application/json' \
    -d '{"phase":"enum","title":"Hello from K3s","cmd":"echo ok"}' \
    http://localhost:8080/api/workspaces/$WS/commands
{"id":"w1","phase":"enum","category":"Custom","title":"Hello from K3s","cmd":"echo ok","note":"","tags":["any"],"ports":[],"source":null,"custom":true}
```

The command was written to Oracle and returned with its database id (`w1`). The health output above was captured
before `/health` details were turned off; it now returns only `UP` / `DOWN`.

## Problems found while deploying

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ORA-00205: error in identifying control file` | The `-faststart` Oracle image ships its data files in `/opt/oracle/oradata`; the persistent volume mounted there hid them | Switched to the regular `23-slim` image, which creates the database inside the volume |
| `ORA-01081: cannot start already-running ORACLE` on restart | Leftovers of the crashed first start in the same pod | Deleted the StatefulSet and its volume claim, re-applied |
| API: `SocketException: Operation not permitted` | Oracle not ready yet, so the `oracle` service had no endpoints and Cilium refused the connection | Resolved itself once Oracle passed its readiness probe |
| Placeholder passwords applied | The example secret sat next to the real one in `k8s/` | Moved it to `k8s/examples/`; passwords are generated with `openssl rand` |
