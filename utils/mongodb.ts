import { Collection, Filter, MongoClient } from "mongodb"
import { IFileStatus } from "./telegram"

class MongoDB {
  private static instance: MongoDB 
  private mongoInstance: MongoClient
  private collection: Collection<IFileStatus>
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance() {
    if(!MongoDB.instance) {
      this.instance = new MongoDB()
    }
    return this.instance
  }

  public async connect(collection: string) {
    const mongo = new MongoClient("mongodb://localhost:27017/", {})
    this.mongoInstance = await mongo.connect()
    this.collection = this.mongoInstance.db("sector").collection(collection)
  }
  public async insertDownloadFile(data: IFileStatus[]) {
    return this.collection.insertMany(data)
  }
  public async updateManyDowloadStatusByFileId(file_id: string[], status: IFileStatus["status"]){
    return this.collection.updateOne({file_id: {$in: file_id}}, {$set:{status}})
  }
  public async updateDowloadStatusByFileId(file_id: string, status: IFileStatus["status"]){
    return this.collection.updateOne({file_id}, {$set:{status}})
  }
  public async getDownloadData(filter?: Filter<IFileStatus>){
    return this.collection.find(filter).toArray()
  }
  public async disconnect(){
    this.mongoInstance.close()
  }
}
export default MongoDB.getInstance()