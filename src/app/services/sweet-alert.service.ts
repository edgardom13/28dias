import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {
  
  // ✅ Mensaje centrado en la pantalla (igual en móvil y desktop)
  async showSuccess(title: string, text?: string) {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      position: 'center',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
      toast: false,
      customClass: {
        popup: 'swal28dias-centered-popup',
        title: 'swal28dias-centered-title',
      },
      didOpen: (popup) => {
        // Asegurar que se centre
        popup.style.margin = '0 auto';
      }
    });
  }

  async showError(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: text,
      position: 'center',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      toast: false,
      customClass: {
        popup: 'swal28dias-centered-popup',
        title: 'swal28dias-centered-title',
      }
    });
  }

  async showWarning(title: string, text?: string) {
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
      position: 'center',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      toast: false,
      customClass: {
        popup: 'swal28dias-centered-popup',
        title: 'swal28dias-centered-title',
      }
    });
  }

  // Método success tradicional (con botón)
  async success(title: string, text?: string, timer: number = 0) {
    return Swal.fire({
      icon: 'success',
      title: title,
      text: text,
      confirmButtonText: 'Aceptar',
      timer: timer,
      timerProgressBar: timer > 0,
      showConfirmButton: timer === 0,
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
        confirmButton: 'swal28dias-confirm',
      }
    });
  }

  // Método error tradicional
  async error(title: string, text?: string) {
    return Swal.fire({
      icon: 'error',
      title: title,
      text: text,
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
        confirmButton: 'swal28dias-confirm',
      }
    });
  }

  // Método warning tradicional
  async warning(title: string, text?: string) {
    return Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
        confirmButton: 'swal28dias-confirm',
      }
    });
  }

  // Método info
  async info(title: string, text?: string) {
    return Swal.fire({
      icon: 'info',
      title: title,
      text: text,
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
        confirmButton: 'swal28dias-confirm',
      }
    });
  }

  // Método confirm
  async confirm(title: string, text: string, confirmText: string = 'Sí, eliminar', cancelText: string = 'Cancelar') {
    const result = await Swal.fire({
      icon: 'warning',
      title: title,
      text: text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
        confirmButton: 'swal28dias-confirm-danger',
        cancelButton: 'swal28dias-cancel',
      }
    });
    
    return result.isConfirmed;
  }

  // Método loading
  loading(title: string = 'Procesando...', text?: string) {
    Swal.fire({
      title: title,
      text: text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      customClass: {
        popup: 'swal28dias-popup',
        title: 'swal28dias-title',
      },
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  // Método toast (para notificaciones en esquina)
  async toast(icon: 'success' | 'error' | 'warning' | 'info', title: string, position: any = 'top-end', timer: number = 3000) {
    const Toast = Swal.mixin({
      toast: true,
      position: position,
      showConfirmButton: false,
      timer: timer,
      timerProgressBar: true,
      customClass: {
        popup: 'swal28dias-toast',
        title: 'swal28dias-toast-title',
      },
    });

    return Toast.fire({
      icon: icon,
      title: title,
    });
  }

  // Cerrar alerta
  close() {
    Swal.close();
  }
}