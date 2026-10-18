import os, json, hmac, hashlib, time, uuid, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

HOST=os.environ.get("HOST","0.0.0.0")
PORT=int(os.environ.get("PORT","10000"))
TOKEN=os.environ.get("MPT_RUNNER_TOKEN","")
JOBS={}
LOCK=threading.Lock()

def worker(job_id):
    with LOCK:
        JOBS[job_id]["status"]="blocked"
        JOBS[job_id]["error"]="MoneyPrinterTurbo engine is not installed/configured on this runner. No video generated."
        JOBS[job_id]["updated_at"]=time.time()

class Handler(BaseHTTPRequestHandler):
    def respond(self,status,data):
        raw=json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def authorized(self,body=b""):
        if not TOKEN: return False
        supplied=self.headers.get("x-jarvis-signature","")
        digest="sha256="+hmac.new(TOKEN.encode(),body,hashlib.sha256).hexdigest()
        return hmac.compare_digest(supplied,digest)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=="/health": return self.respond(200,{"status":"ok","engine":"unconfigured","production_ready":False})
        if not self.authorized():return self.respond(401,{"error":"unauthorized"})
        if path.startswith("/jobs/"):
            job_id=path.split("/")[2]
            with LOCK:job=JOBS.get(job_id)
            return self.respond(200,job) if job else self.respond(404,{"error":"not found"})
        self.respond(404,{"error":"not found"})
    def do_POST(self):
        size=int(self.headers.get("Content-Length","0"))
        if size<1 or size>16384:return self.respond(413,{"error":"invalid request size"})
        body=self.rfile.read(size)
        if not self.authorized(body):return self.respond(401,{"error":"unauthorized"})
        path=urlparse(self.path).path
        if path!="/jobs":return self.respond(404,{"error":"not found"})
        try:
            data=json.loads(body)
            assert isinstance(data.get("topic"),str) and 1<=len(data["topic"])<=500
            assert data.get("aspect") in ("9:16","16:9","1:1")
            assert data.get("auto_publish") is False and data.get("allow_paid_services") is False
        except (ValueError,AssertionError,TypeError):return self.respond(400,{"error":"invalid job payload"})
        job_id=str(uuid.uuid4())
        with LOCK:JOBS[job_id]={"id":job_id,"status":"queued","created_at":time.time(),"topic":data["topic"],"aspect":data["aspect"]}
        threading.Thread(target=worker,args=(job_id,),daemon=True).start()
        self.respond(202,{"id":job_id,"status":"queued"})
    def log_message(self,fmt,*args):pass

if __name__=="__main__":
    if not TOKEN:raise SystemExit("MPT_RUNNER_TOKEN required")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
