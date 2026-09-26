import SwiftUI

struct EcuChatView: View {
 @Environment(\.dismiss) private var dismiss
 @State private var messages:[ChatMessage]=[]; @State private var input=""; @State private var attachments:[NativeAttachment]=[]; @State private var activeFiles:[NativeAttachment]=[]; @State private var sending=false; @State private var showFiles=false; @State private var showDashboard=false
 private let api=JarvisAPI()
 var body: some View { NavigationStack { VStack(spacing:0) { ScrollView { LazyVStack(alignment:.leading,spacing:14) { if messages.isEmpty { VStack(spacing:10){Image(systemName:"waveform.path.ecg.rectangle").font(.system(size:42));Text("ECU Brain Sohbeti").font(.title2.bold());Text("BIN/ORI dosyanı buraya yükle. Dosya doğrudan ECU Brain analiz hattına gider.").multilineTextAlignment(.center).foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(.top,70).padding(.horizontal,24) }; ForEach(messages){m in HStack{if m.role=="user"{Spacer(minLength:40)};Text(m.content).padding(12).background(m.role=="user" ? Color.secondary.opacity(0.16):Color.clear,in:RoundedRectangle(cornerRadius:16));if m.role != "user"{Spacer(minLength:24)}}} }.padding() }; if !attachments.isEmpty { ScrollView(.horizontal,showsIndicators:false){HStack{ForEach(attachments){f in HStack{Image(systemName:"doc.badge.plus");Text(f.name).font(.caption);Button{attachments.removeAll{$0.id==f.id}}label:{Image(systemName:"xmark.circle.fill")}}.padding(8).background(Color.blue.opacity(0.10),in:Capsule())}}.padding(.horizontal)}.padding(.vertical,6) }
else if !activeFiles.isEmpty { ScrollView(.horizontal,showsIndicators:false){HStack{ForEach(activeFiles){f in HStack{Image(systemName:"memorychip");VStack(alignment:.leading,spacing:1){Text("Aktif dosya").font(.caption2).foregroundStyle(.secondary);Text(f.name).font(.caption).lineLimit(1)};Button{clearActiveFiles()}label:{Image(systemName:"xmark.circle.fill")}}.padding(8).background(Color.green.opacity(0.10),in:Capsule())}}.padding(.horizontal)}.padding(.vertical,6) }; HStack(alignment:.bottom,spacing:8){Button{showFiles=true}label:{Image(systemName:"plus").frame(width:38,height:38)};TextField("ECU Brain'e yaz",text:$input,axis:.vertical).lineLimit(1...5).padding(10);Button{Task{await send()}}label:{Image(systemName:sending ? "hourglass":"arrow.up").frame(width:38,height:38).background(Color.accentColor,in:Circle()).foregroundStyle(.white)}.disabled(sending||(input.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty&&attachments.isEmpty))}.padding().background(.thinMaterial) }.navigationTitle("ECU Brain").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.topBarLeading){Button("Kapat"){dismiss()}};ToolbarItem(placement:.topBarTrailing){Button{showDashboard=true}label:{Image(systemName:"gauge.with.dots.needle.67percent")}}} }.sheet(isPresented:$showDashboard){EcuBrainView().presentationDetents([.large])}.sheet(isPresented:$showFiles){UniversalDocumentPicker(allowsMultipleSelection:true){urls in showFiles=false;attachments=[];for url in urls.prefix(4){if let a=try? NativeAttachment.from(url:url){attachments.append(a)}}}onCancel:{showFiles=false}.ignoresSafeArea()}.onAppear{loadActiveFiles()} }
 private func send() async { guard !sending else{return};let typed=input.trimmingCharacters(in:.whitespacesAndNewlines);let text=typed.isEmpty ? "Bu BIN dosyasını analiz et ve sonucu ver.":typed;let newlySelected=attachments;let files=newlySelected.isEmpty ? activeFiles : newlySelected;if !newlySelected.isEmpty{activeFiles=newlySelected;persistActiveFiles(newlySelected)};input="";attachments=[];sending=true;let visible=files.isEmpty ? text:"\(text)\n📎 \(files.map(\.name).joined(separator:", "))";messages.append(ChatMessage(role:"user",content:visible,createdAt:Date().timeIntervalSince1970*1000));do{let r=try await api.send(text:text,attachments:files,channel:"ecu");messages.append(ChatMessage(role:"assistant",content:r.reply,provider:r.provider,createdAt:Date().timeIntervalSince1970*1000))}catch{attachments=files;messages.append(ChatMessage(role:"assistant",content:"ECU Brain hatası: \(error.localizedDescription)",provider:"JARVIS ECU Brain",createdAt:Date().timeIntervalSince1970*1000))};sending=false }
 private struct PersistedEcuFile: Codable { let name:String; let mimeType:String; let file:String }
 private var activeDirectory: URL {
  let base=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask).first!
  return base.appendingPathComponent("JARVIS/ecu-active",isDirectory:true)
 }
 private func persistActiveFiles(_ files:[NativeAttachment]) {
  do {
   let fm=FileManager.default
   let dir=activeDirectory
   try fm.createDirectory(at:dir,withIntermediateDirectories:true)
   if let existing=try? fm.contentsOfDirectory(at:dir,includingPropertiesForKeys:nil){for url in existing{try? fm.removeItem(at:url)}}
   var manifest:[PersistedEcuFile]=[]
   for (index,item) in files.prefix(2).enumerated(){
    let fileName="active-\(index).bin"
    try item.data.write(to:dir.appendingPathComponent(fileName),options:.atomic)
    manifest.append(PersistedEcuFile(name:item.name,mimeType:item.mimeType,file:fileName))
   }
   let data=try JSONEncoder().encode(manifest)
   try data.write(to:dir.appendingPathComponent("manifest.json"),options:.atomic)
  } catch {}
 }
 private func loadActiveFiles() {
  let dir=activeDirectory
  guard let manifestData=try? Data(contentsOf:dir.appendingPathComponent("manifest.json")),
        let manifest=try? JSONDecoder().decode([PersistedEcuFile].self,from:manifestData) else { return }
  activeFiles=manifest.compactMap { item in
   guard let data=try? Data(contentsOf:dir.appendingPathComponent(item.file)) else { return nil }
   return NativeAttachment(name:item.name,mimeType:item.mimeType,data:data)
  }
 }
 private func clearActiveFiles() {
  activeFiles=[]
  try? FileManager.default.removeItem(at:activeDirectory)
 }
}
