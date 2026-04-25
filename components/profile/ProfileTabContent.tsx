import BasicInfoCard from './BasicInfoCard'
import ResponsibilitiesCard from './ResponsibilitiesCard'
import CareerDirectionCard from './CareerDirectionCard'
import { UserProfile } from '@/types'

interface ProfileTabContentProps {
  profile: UserProfile | null
  onProfileUpdate: (updated: Partial<UserProfile>) => void
}

export default function ProfileTabContent({ profile, onProfileUpdate }: ProfileTabContentProps) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BasicInfoCard profile={profile} onUpdate={onProfileUpdate} />
      <ResponsibilitiesCard profile={profile} onUpdate={onProfileUpdate} />
      <CareerDirectionCard profile={profile} onUpdate={onProfileUpdate} />
    </div>
  )
}
