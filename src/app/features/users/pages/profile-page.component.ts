import { Component, inject } from '@angular/core';
import { UserService } from '../services/user.service';
import { AuthService } from '../../auth/services/auth.service';

@Component({
    selector: 'app-profile-page',
    standalone: true,
    imports: [],
    templateUrl: './profile-page.component.html',
})

export class ProfilePageComponent {
    private readonly authService = inject(AuthService);
    private readonly userService = inject(UserService);
}