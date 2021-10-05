import { Express, Request, Response } from 'express'

export class HealthApiController {
  constructor(private app: Express, private controllerPath: string) {}

  public register() {
    this.app.get(this.controllerPath, this.handle)
  }

  private handle(request: Request, response: Response) {
    return response.send('health info')
  }
}
