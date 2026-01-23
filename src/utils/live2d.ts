// @ts-nocheck
import * as PIXI from 'pixi.js'
import { InternalModel, Live2DModel, MotionPriority, SoundManager } from 'pixi-live2d-display'
import { MotionSync } from 'live2d-motionsync'
window.PIXI = PIXI

interface ModelOption {
  modelJson: string
  canvasID: string
  autoInteract?: boolean
  containerID: string
  params?: {
    scale?: number
    rotate: number
    anchor?: {
      x: number
      y: number
    }
  }
}

export class Live2dCreator {
  modelOption: ModelOption
  static model: Live2DModel
  static app: PIXI.Application
  static motionSync: MotionSync
  json: {
    HitAreas: {
      Name: string
      Id: string
      Motion?: string
    }[]
  }
  constructor(modelOption: ModelOption) {
    this.modelOption = modelOption
    if (window.erosModel) {
      window.erosModel = undefined
    }
  }

  async initModel(func: () => void) {
    // 引入模型
    const model = await Live2DModel.from(this.modelOption.modelJson, {
      autoInteract: this.modelOption.autoInteract ?? true
    })
    window.erosModel = model
    this.model = model
    const motionSync = new MotionSync(model.internalModel)
    try {
      await motionSync.loadDefaultMotionSync()
      this.motionSync = motionSync
    } catch {
      console.warn('No MotionSync')
    }
    // 创建模型对象
    PIXI.settings.RESOLUTION = 3
    const app = new PIXI.Application({
      view: document.getElementById(this.modelOption.canvasID),
      autoStart: true,
      resizeTo: document.getElementById(this.modelOption.containerID),
      // 透明
      backgroundAlpha: 0
    })
    this.app = app
    // 添加模型到舞台
    let isRenderComplete = false
    app.stage.addChild(model)
    app.ticker.add(() => {
      // 检查是否渲染完成
      if (!isRenderComplete) {
        if (model.visible) {
          func()
          isRenderComplete = true
          // 一旦渲染完成，你可以停止或做其他处理
        }
      }
    })
    // 模型的缩放
    model.scale.set(this.modelOption.params.scale || 0.15)
    model.anchor.set(this.modelOption.params?.anchor?.x || 0.5, this.modelOption.params?.anchor?.y || 0.5)
    model.rotation = Math.PI * this.modelOption.params.rotate * 2 || 0
    // 模型的位置,x,y相较于窗口左上角
    model.x = document.getElementById(this.modelOption.containerID).getBoundingClientRect().width / 2
    model.y = document.getElementById(this.modelOption.containerID).getBoundingClientRect().height / 2

    // // 添加模型状态管理器
    model.InternalModel = new InternalModel(model)
    // this.registerDefaultTap()
  }

  setScale(scale) {
    const targetArea =
      document.getElementById(this.modelOption.containerID).getBoundingClientRect().width *
      document.getElementById(this.modelOption.containerID).getBoundingClientRect().height
    const area1 = 375 * 812
    const targetScale = scale * (targetArea / area1)
    window.erosModel.scale.set(targetScale)
    window.erosModel.x = document.getElementById(this.modelOption.canvasID).clientWidth / 2
    window.erosModel.y = document.getElementById(this.modelOption.canvasID).clientHeight / 2
  }

  setAngle(angle) {
    window.erosModel.rotation = Math.PI * angle * 2
    window.erosModel.x = document.getElementById(this.modelOption.containerID).getBoundingClientRect().width / 2
    window.erosModel.y = document.getElementById(this.modelOption.containerID).getBoundingClientRect().height / 2
  }

  setAnchor(x: number, y: number) {
    window.erosModel.anchor.set(x, y)
    window.erosModel.x = document.getElementById(this.modelOption.containerID).getBoundingClientRect().width / 2
    window.erosModel.y = document.getElementById(this.modelOption.containerID).getBoundingClientRect().height / 2
  }

  setParameterValueById(id: string, value: number) {
    this.model.internalModel.coreModel.setParameterValueById(id, value)
  }

  registerHitEvent(func: (hitArea: string[]) => void) {
    try {
      window.erosModel.on('hit', func)
    } catch (e) {
      console.warn(e)
    }
  }

  registerDefaultTap() {
    try {
      window.erosModel.on('pointerdown', () => {
        this.motionTrigger('tap', undefined, MotionPriority.NORMAL)
      })
    } catch (e) {
      console.warn(e)
    }
  }

  motionTrigger(type, index = 0, priority: MotionPriority = MotionPriority.FORCE) {
    window.erosModel?.motion(type, index, priority)
  }

  stopAllMotion() {
    delete window.erosModel?.internalModel.motionManager.definitions['Idle']
    window.erosModel?.internalModel.motionManager.stopAllMotions()
    window.erosModel?.internalModel.focusController.focus(0, 0)
  }

  expressionTrigger(type) {
    window.erosModel?.expression(type)
  }

  triggerMotionSync(url: string, func?: { onStop?: () => void }) {
    console.log(1212121)
    this.motionSync.reset()
    this.motionSync.play(url).then((res) => {
      console.log(res, '口型成功')
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      func?.onStop && func.onStop()
    })
  }

  stopMotionSync() {
    this?.motionSync?.reset()
  }

  destroySound() {
    SoundManager.destroy()
  }
}
