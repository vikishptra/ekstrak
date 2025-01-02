import { IFileStatus } from "./telegram";
import { execSync } from 'child_process';
import fs from 'fs'
import mongodb from "./mongodb";
import { Worker } from "cluster";
const passwordList = fs.readFileSync('listPass.txt', {encoding: 'utf-8'}).split(/\n/)
export const extract = async (file: IFileStatus[]) => {
  await Promise.all(file.map(async(data) =>{
    await mongodb.updateDowloadStatusByFileId(data.file_id, "extracting")
  }))
  if(!fs.existsSync(`${process.cwd()}/_td_files/documents/extracted`)){
    fs.mkdirSync(`${process.cwd()}/_td_files/documents/extracted`);
  }
  if(file.length){
    await Promise.all(file.map(async(data) => {
      if(data.mimetype === "application/zip"){
        let retry = -1
        let isFailed = true
        console.log("Extracting: ", data.name)
        while (isFailed) {
          try{
            await zipCommand(`${process.cwd()}/_td_files/documents/${data.name}`, `${process.cwd()}/_td_files/documents/extracted/${data.name}`, retry === -1 ? data?.password : passwordList[retry], data)
            isFailed = false
          }catch (err) {
            if(retry === passwordList.length){
              isFailed = false
            } else {
              isFailed = true
              retry++
              console.log("Extract Failed, retry other password: ", passwordList[retry])
            }
          }
        }
        if(retry === passwordList.length){
          console.log("Failed extract: ERROR NO PASSWORD MATCH for ", data.name)
          const result = await mongodb.updateDowloadStatusByFileId(data.file_id, "ERROR NO PASSWORD MATCH")
          console.log("Update Mongodb Result: ", JSON.stringify(result))
        } else {
          console.log(`Complete extract: ${data.name} ${data.file_id}`)
          console.log(`Update status: ${data.name} ${data.file_id}`)
          const result = await mongodb.updateDowloadStatusByFileId(data.file_id, "extracted")
          console.log("Update Mongodb Result: ", JSON.stringify(result))
        }
      }
      if(data.mimetype === "application/vnd.rar"){
        let retry = -1
        let isFailed = true
        console.log("Extracting: ", data.name)
        while (isFailed) {
          try{
            await rarCommand(`${process.cwd()}/_td_files/documents/${data.name}`, `${process.cwd()}/_td_files/documents/extracted/${data.name}`, retry === -1 ? data?.password : passwordList[retry], data) 
            isFailed = false
          } catch (err) {
            if(retry === passwordList.length){
              isFailed = false
            } else {
              isFailed = true
              retry++
              console.log("Extract Failed, retry other password: ", passwordList[retry])
            }
          }
        }
        if(retry === passwordList.length){
          console.log("Failed extract: ERROR NO PASSWORD MATCH for ", data.name)
          const result = await mongodb.updateDowloadStatusByFileId(data.file_id, "ERROR NO PASSWORD MATCH")
          console.log("Update Mongodb Result: ", JSON.stringify(result))
        } else {
          console.log(`Complete extract: ${data.name} ${data.file_id}`)
          console.log(`Update status: ${data.name} ${data.file_id}`)
          const result = await mongodb.updateDowloadStatusByFileId(data.file_id, "extracted")
          console.log("Update Mongodb Result: ", JSON.stringify(result))
        }
      }
    }))
  }
}

const rarCommand = async (rarilePath: string, extractToPath: string, password: string, data?: IFileStatus) => {
    const path = `${process.cwd()}/_td_files/documents/extracted/${data.name.slice(0,-4)}`
    if(!fs.existsSync(path)){
      fs.mkdirSync(path);
    } else {
      fs.rmSync(path, {recursive: true, force: true});
      fs.mkdirSync(path);
    }
    const command = `unrar x "${rarilePath}" ${password !== "undefined" ? '-p"' + password + '"' : ""} ${process.cwd()}/_td_files/documents/extracted/"${data.name.slice(0,-4)}"`;
    console.log(`Extracting: ${rarilePath} to ${extractToPath}`)
    console.log(`Command ${command}`)
    execSync(command, { maxBuffer: 1024 * 1024 * 200, stdio: 'ignore' });
  }

const zipCommand = async (zipFilePath: string, extractToPath: string, password: string, data?: IFileStatus) => {
    const path = `${process.cwd()}/_td_files/documents/extracted/${data.name.slice(0,-4)}`
    if(!fs.existsSync(path)){
      fs.mkdirSync(path);
    } else {
      fs.rmSync(path, {recursive: true, force: true});
      fs.mkdirSync(path);
    }
    const command = `7z e "${zipFilePath}" -o"${path}" ${password !== "undefined" ? '-p"' + password + '"' : ""} -y`;
    console.log(`Extracting: ${zipFilePath} to ${path}`)
    console.log(`Command ${command}`)
    execSync(command, {stdio: 'ignore'});
}