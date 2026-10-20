import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '../services/notification';
import { NewPostDialogData } from '../services/mur-types';

@Component({
  selector: 'app-new-post-dialog',
  templateUrl: './mur-newPost-dialog.html',
  imports: [ReactiveFormsModule, MatDialogModule, MatInputModule, MatButtonModule],
})
export class NewPostDialog {
  postform: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<NewPostDialog>,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: NewPostDialogData | null
  ) {
    this.postform = this.fb.group({
      content: ['', Validators.required],
      image: [''],
      imageTitle: [''],
      hashtags: ['']
    });
  }

  submit() {
    if (this.postform.valid) {
      if (this.postform.value.image) {
        if (!this.postform.value.imageTitle) {
          this.notificationService.show("Veuillez fournir un titre pour l'image", 'error');
          return;
        }
        if (this.postform.value.image.length > 0 && !this.postform.value.image.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif)$/i)) {
          this.notificationService.show("Veuillez fournir une URL d'image valide (jpg, jpeg, png, gif)", 'error');
          return;
        }
      }

      const data = this.postform.value;
      data.hashtags = (this.postform.value.hashtags || '').split(' ').filter((tag: string) => tag.startsWith('#'));
      
      if (this.data?.sharedPostId) {
        data.shared = this.data.sharedPostId;
      }
      this.dialogRef.close(data);
    }
  }
}
