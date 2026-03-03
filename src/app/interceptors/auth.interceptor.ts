import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
<<<<<<< HEAD
    console.log('Auth interceptor: Adding token to request', req.url);
    return next(cloned);
  }
  
  console.log('Auth interceptor: No token found for request', req.url);
=======
    return next(cloned);
  }
  
>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
  return next(req);
};
