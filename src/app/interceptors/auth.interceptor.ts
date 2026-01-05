import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    console.log('Auth interceptor: Adding token to request', req.url);
    return next(cloned);
  }
  
  console.log('Auth interceptor: No token found for request', req.url);
  return next(req);
};
