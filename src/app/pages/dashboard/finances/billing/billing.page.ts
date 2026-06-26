import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonSpinner, IonToast } from '@ionic/angular/standalone';
import { AuthService } from '../../../../services/auth.service';
import { SupabaseService } from '../../../../services/supabase.service';

@Component({
  selector: 'app-billing-config',
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner, IonToast]
})
export class BillingConfigPage implements OnInit {
  businessId: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  showToast: boolean = false;
  toastMessage: string = '';
  toastColor: string = 'success';

  // Datos fiscales
  fiscalData = {
    rfc: '',
    business_name: '',
    tax_regime: '601',
    postal_code: '',
    fiscal_address: '',
    expedition_place: ''
  };

  // Credenciales Finkok
  finkokData = {
    username: '',
    password: '',
    test_mode: true
  };

  // Certificados CSD
  cerFile: File | null = null;
  keyFile: File | null = null;
  cerPassword: string = '';
  cerContent: string = '';
  keyContent: string = '';
  cerExpiration: string = '';

  // Regímenes fiscales comunes
  taxRegimes = [
    { code: '601', name: 'General de Ley Personas Morales' },
    { code: '603', name: 'Personas Morales con Fines no Lucrativos' },
    { code: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { code: '606', name: 'Arrendamiento' },
    { code: '608', name: 'Demás ingresos' },
    { code: '610', name: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
    { code: '611', name: 'Ingresos con Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { code: '612', name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { code: '614', name: 'Ingresos por intereses' },
    { code: '615', name: 'Ingresos por obtención de premios' },
    { code: '616', name: 'Sin obligaciones fiscales' },
    { code: '620', name: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
    { code: '621', name: 'Incorporación Fiscal' },
    { code: '622', name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { code: '623', name: 'Opcional para Grupos de Sociedades' },
    { code: '624', name: 'Coordinados' },
    { code: '625', name: 'Actividades con Plataformas Tecnológicas' },
    { code: '626', name: 'Régimen Simplificado de Confianza' }
  ];

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        this.fiscalData.business_name = profile.profile.business_name || '';
        await this.loadConfig();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      this.showToastMessage('Error al cargar los datos', 'danger');
    }
  }

  async loadConfig() {
    this.isLoading = true;
    try {
      const { data, error } = await this.supabase
        .from('business_tax_config')
        .select('*')
        .eq('business_id', this.businessId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        this.fiscalData = {
          rfc: data.rfc || '',
          business_name: data.business_name || this.fiscalData.business_name,
          tax_regime: data.tax_regime || '601',
          postal_code: data.postal_code || '',
          fiscal_address: data.fiscal_address || '',
          expedition_place: data.expedition_place || data.postal_code || ''
        };

        this.finkokData = {
          username: data.finkok_username || '',
          password: data.finkok_password || '',
          test_mode: data.finkok_test_mode ?? true
        };

        this.cerPassword = data.cer_password || '';
        this.cerExpiration = data.cer_expiration || '';

        if (data.cer_content) {
          this.cerContent = data.cer_content;
          this.showToastMessage('Certificado .cer cargado', 'success');
        }
        if (data.key_content) {
          this.keyContent = data.key_content;
          this.showToastMessage('Certificado .key cargado', 'success');
        }
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      this.showToastMessage('Error al cargar la configuración', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  onCerFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.cer')) {
        this.cerFile = file;
        this.readFileAsBase64(file).then(base64 => {
          this.cerContent = base64;
          this.showToastMessage(`Archivo ${file.name} cargado`, 'success');
        });
      } else {
        this.showToastMessage('El archivo debe tener extensión .cer', 'warning');
      }
    }
  }

  onKeyFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.key')) {
        this.keyFile = file;
        this.readFileAsBase64(file).then(base64 => {
          this.keyContent = base64;
          this.showToastMessage(`Archivo ${file.name} cargado`, 'success');
        });
      } else {
        this.showToastMessage('El archivo debe tener extensión .key', 'warning');
      }
    }
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo el base64 sin el prefijo data:...
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async saveConfig() {
    // Validaciones
    if (!this.fiscalData.rfc || !this.fiscalData.tax_regime || !this.fiscalData.postal_code) {
      this.showToastMessage('Completa los campos fiscales obligatorios', 'warning');
      return;
    }

    if (!this.finkokData.username || !this.finkokData.password) {
      this.showToastMessage('Completa las credenciales de Finkok', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      const configData = {
        business_id: this.businessId,
        rfc: this.fiscalData.rfc.toUpperCase(),
        business_name: this.fiscalData.business_name,
        tax_regime: this.fiscalData.tax_regime,
        postal_code: this.fiscalData.postal_code,
        fiscal_address: this.fiscalData.fiscal_address || null,
        expedition_place: this.fiscalData.expedition_place || this.fiscalData.postal_code,
        finkok_username: this.finkokData.username,
        finkok_password: this.finkokData.password,
        finkok_test_mode: this.finkokData.test_mode,
        cer_content: this.cerContent || null,
        key_content: this.keyContent || null,
        cer_password: this.cerPassword || null,
        cer_expiration: this.cerExpiration || null
      };

      // Verificar si ya existe configuración
      const { data: existing } = await this.supabase
        .from('business_tax_config')
        .select('id')
        .eq('business_id', this.businessId)
        .single();

      let error;
      if (existing) {
        const result = await this.supabase
          .from('business_tax_config')
          .update(configData)
          .eq('business_id', this.businessId);
        error = result.error;
      } else {
        const result = await this.supabase
          .from('business_tax_config')
          .insert(configData);
        error = result.error;
      }

      if (error) throw error;

      this.showToastMessage('✅ Configuración guardada exitosamente', 'success');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      this.showToastMessage('Error al guardar la configuración', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private showToastMessage(message: string, color: string) {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }
}