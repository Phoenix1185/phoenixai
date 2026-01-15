import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export type PermissionType = 'microphone' | 'camera' | 'notifications';

export interface PermissionState {
  microphone: PermissionStatus | null;
  camera: PermissionStatus | null;
  notifications: NotificationPermission | null;
}

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export function usePermissions() {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: null,
    camera: null,
    notifications: null,
  });
  const [isRequesting, setIsRequesting] = useState(false);

  const checkPermission = useCallback(async (type: PermissionType): Promise<PermissionStatus | NotificationPermission> => {
    try {
      if (type === 'notifications') {
        return Notification.permission;
      }
      
      const permName = type === 'microphone' ? 'microphone' : 'camera';
      const result = await navigator.permissions.query({ name: permName as PermissionName });
      return result.state as PermissionStatus;
    } catch (error) {
      console.error(`Error checking ${type} permission:`, error);
      return 'prompt';
    }
  }, []);

  const requestMicrophone = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      toast({
        title: 'Microphone enabled',
        description: 'Voice features are now available',
      });
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      toast({
        variant: 'destructive',
        title: 'Microphone access denied',
        description: 'Please enable microphone access in your browser settings to use voice features',
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [toast]);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      toast({
        title: 'Camera enabled',
        description: 'Camera features are now available',
      });
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      toast({
        variant: 'destructive',
        title: 'Camera access denied',
        description: 'Please enable camera access in your browser settings',
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [toast]);

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      if (!('Notification' in window)) {
        toast({
          variant: 'destructive',
          title: 'Notifications not supported',
          description: 'Your browser does not support notifications',
        });
        return false;
      }

      const permission = await Notification.requestPermission();
      setPermissions(prev => ({ ...prev, notifications: permission }));
      
      if (permission === 'granted') {
        toast({
          title: 'Notifications enabled',
          description: 'You will receive important updates',
        });
        return true;
      } else {
        toast({
          variant: 'destructive',
          title: 'Notifications blocked',
          description: 'Enable notifications in your browser settings',
        });
        return false;
      }
    } catch (error) {
      console.error('Notification permission error:', error);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [toast]);

  const requestPermission = useCallback(async (type: PermissionType): Promise<boolean> => {
    switch (type) {
      case 'microphone':
        return requestMicrophone();
      case 'camera':
        return requestCamera();
      case 'notifications':
        return requestNotifications();
      default:
        return false;
    }
  }, [requestMicrophone, requestCamera, requestNotifications]);

  const checkAllPermissions = useCallback(async () => {
    const [mic, cam, notif] = await Promise.all([
      checkPermission('microphone'),
      checkPermission('camera'),
      checkPermission('notifications'),
    ]);
    
    setPermissions({
      microphone: mic as PermissionStatus,
      camera: cam as PermissionStatus,
      notifications: notif as NotificationPermission,
    });
  }, [checkPermission]);

  return {
    permissions,
    isRequesting,
    requestPermission,
    requestMicrophone,
    requestCamera,
    requestNotifications,
    checkPermission,
    checkAllPermissions,
  };
}
