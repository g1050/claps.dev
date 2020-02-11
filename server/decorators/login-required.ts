import {
  BoundedMiddleware,
  Routes,
  RoutesKey,
  Target,
} from '@rxts/koa-router-decorators'
import consola from 'consola'
import { Middleware } from 'koa'

import { createOctokit, octokitMap } from '../utils'

export const LoginRequired = (
  target: Target,
  propertyKey?: string,
  descriptor?: PropertyDescriptor,
) => {
  target = propertyKey ? target : target.prototype

  const routes: Routes | undefined = target[RoutesKey]

  if (!routes) {
    throw new ReferenceError('no routes found')
  }

  const handler: BoundedMiddleware = descriptor.value

  const index = routes.findIndex(route => {
    const routeHandler = route.handler
    return Array.isArray(routeHandler)
      ? routeHandler.find(_ => _.original || _ === handler)
      : (routeHandler.original || routeHandler) === handler
  })

  if (index === -1) {
    if (process.env.NODE_ENV === 'development') {
      consola.warn('route should be registered by `RequestMapping` first')
    }
    return
  }

  const oldHandler = routes[index].handler

  const newHandler: Middleware[] = [
    (ctx, next) => {
      const { gitHubToken, user } = ctx.session

      if (!user) {
        return ctx.redirect('/')
      }

      if (!octokitMap.has(user.id)) {
        octokitMap.set(user.id, createOctokit(gitHubToken))
      }

      return next()
    },
    ...(Array.isArray(oldHandler) ? oldHandler : [oldHandler]),
  ]

  routes[index].handler = newHandler
}
