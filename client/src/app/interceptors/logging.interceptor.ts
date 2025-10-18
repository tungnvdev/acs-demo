import { HttpRequest, HttpHandlerFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export function loggingInterceptor(req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
  const timestamp = new Date().toISOString();
  
  // Log outgoing request
  console.log(`[${timestamp}] 🚀 API Request:`, {
    method: req.method,
    url: req.url,
    headers: req.headers.keys().reduce((acc, key) => {
      acc[key] = req.headers.get(key);
      return acc;
    }, {} as any),
    body: req.body
  });

  return next(req).pipe(
    tap(
      event => {
        if (event instanceof HttpResponse) {
          // Log successful response
          console.log(`[${timestamp}] ✅ API Response:`, {
            status: event.status,
            statusText: event.statusText,
            url: req.url,
            body: event.body
          });
        }
      },
      error => {
        // Log error response
        console.log(`[${timestamp}] ❌ API Error:`, {
          status: error.status,
          statusText: error.statusText,
          url: req.url,
          error: error.error,
          message: error.message
        });
      }
    )
  );
}
