import fs from 'fs';
import MultiProgress from 'multi-progress';
import { getTdjson } from 'prebuilt-tdlib';
import ProgressBar from 'progress';
import * as tdl from 'tdl';
import mongodb from '../utils/mongodb';
interface IProgressBar {
    [key: number]: ProgressBar
} 
export interface IFileStatus {
    name: string,
    status: "downloaded" | "downloading" | "extracting" | "extracted" | "deleted" | string
    password: string | undefined
    file_id: string
    mimetype: string
}

class Telegram {
  private static instance: Telegram
  private client: tdl.Client
  private progressBar: IProgressBar = {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
    tdl.configure({ tdjson: getTdjson() })
    this.client  = tdl.createClient({
      apiHash: "be903b96858d53f6a9568897bc5ee88b",
      apiId: 28362726
    })
    this.client.on("update" , async (u) => {
      const fileStatus = await mongodb.getDownloadData()
      if(u._ === "updateFile"){
        const file_id = u.file.remote?.unique_id
        const expected_size = u.file.expected_size
        const downloaded_size = u.file.local.downloaded_size
        const is_complete = u.file.local.is_downloading_completed
        if(is_complete){
          const fileIndex = fileStatus.findIndex(d => d.file_id === file_id)
          if (fileIndex !== -1) {
            fileStatus[fileIndex].status = 'downloaded';
            await mongodb.updateDowloadStatusByFileId(file_id, 'downloaded')
            delete this.progressBar[file_id]
          }
        }
        this.progressBar[file_id]?.update(downloaded_size/expected_size)
      }
    })
  }
  public static getInstance() {
    if(!Telegram.instance) {
      this.instance = new Telegram()
    }
    return this.instance
  }
  public async login(){
    await this.client.login()
  }
  public async downloadFile(){
    try{
      const chats = await this.client.invoke({
        _: 'getChats',
        limit: 1,
      })
      const chat = await this.client.invoke({
        _: 'getChat',
        chat_id: chats.chat_ids[0],
      })
      // console.log(chat.last_message?.id) 
      const chatHistory = await this.client.invoke({
        _: 'getChatHistory',
        chat_id: -1001935880746,
        limit: 10,
        from_message_id: chat.last_message.id,
        only_local: false
      })
      const multiprogress = new MultiProgress()
      console.log("Chat length: ", chatHistory.total_count)
      const newFileData: IFileStatus[] = []
      await Promise.all(chatHistory.messages.map(async (d, i) => {
        try {
          const fileStatus = await mongodb.getDownloadData()
          if (d?.content._ === 'messageDocument') {
            const fileID = d?.content?.document?.document.remote.unique_id
            const fileIndex = fileStatus.findIndex(data => fileID === data.file_id)
            if(!fs.existsSync('_td_files/documents')){
              fs.mkdirSync('_td_files/documents', {recursive: true})
            }
            const dir = fs.readdirSync('_td_files/documents')
            let skipDownload = false
            if(fileIndex !== -1){
              skipDownload = true
            }

            if(fileStatus[fileIndex]?.status && fileStatus.length){
              skipDownload = true
            }          
            this.progressBar[fileID] = multiprogress.newBar(`Downloading: [${fileID}] - ${d?.content?.document?.file_name} [:bar] :percent :etas`, {
              total: d?.content?.document?.document.expected_size
            })
            const data = d.content.caption.text.split(/.info/).filter(f => f.match(/.pass: (@|h|[A-Za-z])/))[0]
            const passwords = data?.replace("🔑 .pass: ", "")
            const password = `${passwords?.replace(/\n📘/g, "").replace(/\n/g, "").replace(/\s/g, "").replace(/⚠️Becarefulwiththisseller!/g, "")}`
            if(fileIndex === -1 && dir.includes((d?.content as any)?.document?.file_name)){
                newFileData.push({
                  name: d?.content?.document?.file_name,
                  password,
                  status: 'downloaded',
                  file_id: fileID,
                  mimetype: d.content.document.mime_type
                })
            }
            if (skipDownload) {
              console.log(`Skip download/Still downloading [${fileID}] - ${d?.content?.document?.file_name}`)
            } else {
              d.content.document.document.remote.unique_id
                newFileData.push({
                  name: d?.content?.document?.file_name,
                  password,
                  status: 'downloading',
                  file_id: fileID,
                  mimetype: d.content.document.mime_type
                })
                await this.client.invoke({
                    _:"downloadFile",
                    priority: i+1,
                    file_id: d?.content?.document?.document.id,
                    synchronous: false
                })
              }
            }
          } catch (err) {
            console.error("ErrChatHistory: ")
            console.error(err)
          }
        }
      ))
      if(newFileData.length){
        await mongodb.insertDownloadFile(newFileData)
      }
    } catch (err) {
      console.error("ErrDownloadFile: ")
      console.error(err)
    }
  }
  public async getDownloadedFileForExtract() {
    const data = await mongodb.getDownloadData({status: "downloaded"})
    if(!data.length){
      return []
    }
    const ids = data.map((d) => d.file_id)
    await mongodb.updateManyDowloadStatusByFileId(ids, 'extracting')
    return data
    
  }
}
export default Telegram