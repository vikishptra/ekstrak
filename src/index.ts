import { CronJob } from "cron"
import { extract } from "../utils/extractor"
import Telegram from "../utils/telegram"
import Parser from "../utils/parser"
import mongodb from "../utils/mongodb"
import axios from "axios"
const main = async () => {
  await mongodb.connect("downloadData")
  const telegram = Telegram.getInstance()
  const parser = Parser.getInstance()
  await telegram.login()  
  let isJobExtract: boolean = false
  const runJob = async () => {
    await telegram.downloadFile()
    const downloadedFile = await mongodb.getDownloadData({ status: 'downloaded' })
    isJobExtract = true
    if(downloadedFile.length){
      await extract(downloadedFile)
    }
    const extractedFile = await mongodb.getDownloadData({ status: 'extracted' })
    if(extractedFile.length){
      try{
        await Promise.all(extractedFile.map(async (d) => {
          const filename = d.name.replace(/\.[a-z]{3,4}$/, "")
          parser.filterTxt(filename, d)
          const parsedData = parser.parseAndGroupJSON(filename)
          await parser.formatDataWithRegex(parsedData, filename, d.file_id)
        }))
      } catch (err){
        console.log(err)
      }
    }
    const formattedFile = await mongodb.getDownloadData({ status: 'formatted' })
    if(formattedFile.length){
      try{
        await Promise.all(formattedFile.map(async(d) => {
          console.log(d.name.replace(/\.[a-z]{3,4}$/, ".json"))
          try{
            // await axios.get('http://192.168.200.103:8002/upload', {
            //   params: {
            //     path: d.name.replace(/\.[a-z]{3,4}$/, ".json")
            //   }
            // })
            await mongodb.updateDowloadStatusByFileId(d.file_id, 'uploaded')
          } catch (err) {
            console.error(err)
          }
        }))
      } catch (err) {
        console.log(err)
      }
    }
    let uploadedData = await mongodb.getDownloadData({ status: 'uploaded' })
    const errorData = await mongodb.getDownloadData({ status: 'ERROR NO PASSWORD MATCH' })
    uploadedData = [...uploadedData, ...errorData]
    if(uploadedData.length){
      await Promise.all(uploadedData.map(async (d) => {
        await parser.removeFile(d.name, d.file_id)
      }))
    }
    isJobExtract = false
  }

  const job = CronJob.from({
    cronTime: '* */1 * * *',
    onTick: async () =>{
      if(!isJobExtract){
        runJob()
      }
    }
  })
  console.log("First job")
  await runJob()
  console.log("Job started")
  job.start()
}

main()
